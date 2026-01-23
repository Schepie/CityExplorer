import json
import argparse
import os
import requests
import io
import sys
import html
import re
from datetime import datetime
from urllib.parse import urljoin, urlparse

# PDF Libraries
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT

# Image & QA
from PIL import Image
from io import BytesIO
import qrcode
from bs4 import BeautifulSoup

# Map
import matplotlib.pyplot as plt
import matplotlib.patches as patches

# --- CONSTANTS ---
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN_H = 2 * cm
MARGIN_TOP = 2 * cm
MARGIN_BOTTOM = 1.6 * cm

ASSETS_DIR = "assets"

# --- HELPER FUNCTIONS ---

def ensure_dir(d):
    if not os.path.exists(d):
        os.makedirs(d)

def safe_float(val, default=0.0):
    try:
        return float(val)
    except (ValueError, TypeError):
        return default

def extract_coords(obj):
    """
    Robustly extracts lat/lng from various object structures.
    Returns (lat, lng) or (0.0, 0.0)
    """
    if not obj:
        return 0.0, 0.0
    
    # Check flat structure first (App.jsx style)
    if 'lat' in obj and 'lng' in obj:
        return safe_float(obj['lat']), safe_float(obj['lng'])
    
    # Check nested location (Common API style)
    loc = obj.get('location')
    if isinstance(loc, dict):
        return safe_float(loc.get('lat', 0)), safe_float(loc.get('lng', 0))
    
    # Check alternate keys
    lat = obj.get('lat') or obj.get('latitude') or 0
    lng = obj.get('lng') or obj.get('longitude') or 0
    return safe_float(lat), safe_float(lng)

def scrape_images(poi, city, max_count=3):
    """
    Advanced scraper for POI images.
    1. Direct image field
    2. OG:image from link
    3. Largest images from link
    Returns list of local paths.
    """
    valid_paths = []
    headers = {'User-Agent': 'CityExplorerBot/1.0 (Student Project)'}
    
    # 1. Direct image
    main_url = poi.get('image')
    if main_url:
        path = download_and_process(main_url, f"poi_{poi.get('id', 'x')}_0")
        if path: valid_paths.append(path)
        
    # 2. Scrape from link
    link = poi.get('link')
    if link and len(valid_paths) < max_count:
        try:
            r = requests.get(link, headers=headers, timeout=5)
            if r.status_code == 200:
                soup = BeautifulSoup(r.content, 'lxml')
                
                potential_urls = []
                
                # OG Image
                og_img = soup.find('meta', property='og:image')
                if og_img and og_img.get('content'):
                    potential_urls.append(og_img['content'])
                    
                # Find other large images
                for img_tag in soup.find_all('img'):
                    src = img_tag.get('src')
                    if not src: continue
                    full_src = urljoin(link, src)
                    # Filter out tiny icons or trackers
                    if any(x in full_src.lower() for x in ['icon', 'logo', 'sprite', 'pixel', 'ad']):
                        continue
                    potential_urls.append(full_src)
                
                # Uniquify and download
                seen = set()
                if main_url: seen.add(main_url)
                
                for p_url in potential_urls:
                    if len(valid_paths) >= max_count: break
                    if p_url in seen: continue
                    seen.add(p_url)
                    
                    path = download_and_process(p_url, f"poi_{poi.get('id', 'x')}_{len(valid_paths)}")
                    if path: valid_paths.append(path)
        except Exception as e:
            print(f"Scrape warning for {poi.get('name')}: {e}")
            
    return valid_paths

def download_and_process(url, filename_prefix, max_dim=1000):
    """Helper to download and resize image safely"""
    if not url: return None
    target_path = os.path.join(ASSETS_DIR, f"{filename_prefix}.jpg")
    try:
        headers = {'User-Agent': 'CityExplorerBot/1.0'}
        r = requests.get(url, headers=headers, timeout=5, stream=True)
        if r.status_code != 200: return None
        
        img = Image.open(BytesIO(r.content))
        img = img.convert('RGB')
        
        # Dimensions Check - Skip if too small (likely ad/icon)
        if img.width < 200 or img.height < 200:
            return None
            
        if max(img.size) > max_dim:
            img.thumbnail((max_dim, max_dim))
        
        img.save(target_path, 'JPEG', quality=85)
        return target_path
    except:
        return None

def generate_qr(data, prefix):
    qr = qrcode.QRCode(box_size=10, border=1)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill='black', back_color='white')
    path = os.path.join(ASSETS_DIR, f"qr_{prefix}.png")
    img.save(path)
    return path

def generate_map(route_data, filename="overview_map.png"):
    """
    Generates a route map using Matplotlib.
    """
    route_path = route_data.get('routePath', [])
    pois = route_data.get('pois', [])
    
    if not route_path and not pois:
        return None

    # Extract coords
    lats = []
    lngs = []
    
    if route_path:
        for p in route_path:
            if isinstance(p, (list, tuple)) and len(p) >= 2:
                lats.append(safe_float(p[0]))
                lngs.append(safe_float(p[1]))
            elif isinstance(p, dict):
                lats.append(safe_float(p.get('lat', 0) or p.get('latitude', 0)))
                lngs.append(safe_float(p.get('lng', 0) or p.get('longitude', 0)))
    
    # If no path, use POIs
    if not lats and pois:
        for p in pois:
            lat, lng = extract_coords(p)
            lats.append(lat)
            lngs.append(lng)

    if not lats:
        return None

    plt.figure(figsize=(8, 6), dpi=150)
    
    # Plot route
    if lats and lngs:
        xpath = lngs
        ypath = lats
        plt.plot(xpath, ypath, color='#3b82f6', linewidth=3, alpha=0.8, label='Route')
        
        # Start/End markers
        if xpath:
            plt.plot(xpath[0], ypath[0], 'go', markersize=10, label='Start')
            plt.plot(xpath[-1], ypath[-1], 'ro', markersize=10, label='End')

    # Plot POIs
    for idx, poi in enumerate(pois):
        lat, lng = extract_coords(poi)
        plt.plot(lng, lat, 'r.', markersize=8)
        plt.text(lng, lat, str(idx+1), fontsize=9, ha='right', weight='bold')

    # Formatting
    plt.title("Route Overview")
    plt.xlabel("Longitude")
    plt.ylabel("Latitude")
    plt.grid(True, linestyle='--', alpha=0.5)
    plt.tight_layout()
    
    # Save
    path = os.path.join(ASSETS_DIR, filename)
    plt.savefig(path)
    plt.close()
    return path

# --- PDF BUILDER CLASS ---

class FooterCanvas(SimpleDocTemplate):
    """Custom doc template for page numbers"""
    pass # ReportLab handles this via build arguments mostly, but defining custom canvas is standard practice for footers.
         # For simplicity, we'll use a page template function.

def add_page_number(canvas, doc):
    page_num = canvas.getPageNumber()
    text = "Page %s" % page_num
    canvas.saveState()
    canvas.setFont('Helvetica', 9)
    # Right align
    canvas.drawRightString(PAGE_WIDTH - MARGIN_H, MARGIN_BOTTOM/2, text)
    canvas.restoreState()

def build_pdf(json_file, logo_file, out_file):
    ensure_dir(ASSETS_DIR)
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    city = data.get('city', 'Unknown City')
    route_data = data.get('routeData', {})
    pois = route_data.get('pois', [])
    stats = route_data.get('stats', {})
    
    # Setup styles
    styles = getSampleStyleSheet()
    style_h1 = ParagraphStyle('H1', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=24, spaceAfter=20)
    style_h2 = ParagraphStyle('H2', parent=styles['Heading2'], fontSize=18, spaceBefore=15, spaceAfter=10, textColor=colors.HexColor('#0f172a'))
    style_h3 = ParagraphStyle('H3', parent=styles['Heading3'], fontSize=14, spaceBefore=10, textColor=colors.HexColor('#334155'))
    style_norm = ParagraphStyle('Norm', parent=styles['Normal'], fontSize=11, leading=14, spaceAfter=8)
    style_small = ParagraphStyle('Small', parent=styles['Normal'], fontSize=9, textColor=colors.grey)
    
    story = []
    
    # --- 1. COVER ---
    if logo_file and os.path.exists(logo_file):
        im = RLImage(logo_file, width=9*cm, height=9*cm)
        im.hAlign = 'CENTER'
        # Maintain aspect ratio logic could be added but explicit width request was max 9cm.
        # ReportLab image scaling requires explicit calc usually, but we assume input is reasonable or auto-scaled by RL if constraints given.
        # Actually RLImage takes explicit w/h. Let's maximize fit.
        img_obj = Image.open(logo_file)
        aspect = img_obj.height / img_obj.width
        target_w = 9*cm
        target_h = target_w * aspect
        if target_h > 9*cm:
            target_h = 9*cm
            target_w = target_h / aspect
        
        im = RLImage(logo_file, width=target_w, height=target_h)
        im.hAlign = 'CENTER'
        story.append(Spacer(1, 4*cm)) # Push down
        story.append(im)
        story.append(Spacer(1, 2*cm))

    story.append(Paragraph(f"{html.escape(city)} – Travel Booklet", style_h1))
    
    # Metadata
    total_dist = safe_float(stats.get('totalDistance', 0))
    walk_dist = safe_float(stats.get('walkDistance', 0))
    
    interests_text = html.escape(data.get('interests', 'General'))
    meta_text = [
        f"<b>Interests:</b> {interests_text}",
        f"<b>Planned Distance:</b> {total_dist:.1f} km",
        f"<b>Walking Buffer:</b> {walk_dist:.1f} km",
        f"<b>Route Type:</b> {'Roundtrip' if data.get('isRoundtrip') else 'One-way'}"
    ]
    for line in meta_text:
        story.append(Paragraph(line, ParagraphStyle('Meta', parent=style_norm, alignment=TA_CENTER)))
        
    story.append(PageBreak())
    
    # --- 2. OVERVIEW MAP ---
    story.append(Paragraph("Overview Map", style_h2))
    map_path = generate_map(route_data)
    if map_path:
        im_map = RLImage(map_path, width=16*cm, height=12*cm) # Max width fit
        story.append(im_map)
    
    # Stats Table
    limit_km = safe_float(stats.get('limitKm', 0))
    stats_data = [
        ['Total Distance', f"{total_dist:.1f} km"],
        ['Walking Distance', f"{walk_dist:.1f} km"],
        ['Limit', f"{limit_km:.1f} km"] if limit_km > 0 else ['Limit', 'N/A']
    ]
    t = Table(stats_data, colWidths=[6*cm, 4*cm], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.whitesmoke),
        ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(Spacer(1, 1*cm))
    story.append(t)
    story.append(PageBreak())
    
    # --- 3. POINTS OF INTEREST (TOC) ---
    story.append(Paragraph("Points of Interest", style_h2))
    
    for idx, poi in enumerate(pois):
        p_name = html.escape(poi.get('name', 'POI'))
        address = html.escape(poi.get('address', 'Unknown Address'))
        text = f"<b>{idx+1}. {p_name}</b><br/><font size=9 color=grey>{address}</font>"
        story.append(Paragraph(text, style_norm))
        story.append(Spacer(1, 0.2*cm))
        
    # --- 4. TURN-BY-TURN INSTRUCTIONS ---
    story.append(Paragraph("Navigation Instructions", style_h2))
    steps = route_data.get('navigationSteps', [])
    if steps:
        # Table Header
        step_data = [[
            Paragraph("<b>Mode</b>", style_small),
            Paragraph("<b>Instruction</b>", style_small),
            Paragraph("<b>Dist.</b>", style_small),
            Paragraph("<b>Dur.</b>", style_small)
        ]]
        
        for step in steps:
            mode = step.get('mode', 'walk').capitalize()
            # Instructions extraction
            maneuver = step.get('maneuver', {})
            instr = maneuver.get('instruction', '')
            if not instr:
                m_type = maneuver.get('type', 'go').capitalize()
                m_mod = maneuver.get('modifier', '').replace('_', ' ')
                street = step.get('name', '')
                instr = f"{m_type} {m_mod}"
                if street: instr += f" onto {street}"
            
            dist = f"{step.get('distance', 0):.0f}m"
            dur = f"{step.get('duration', 0)/60:.1f} min"
            
            step_data.append([
                Paragraph(mode, style_small),
                Paragraph(html.escape(instr), style_small),
                Paragraph(dist, style_small),
                Paragraph(dur, style_small)
            ])
            
        t_steps = Table(step_data, colWidths=[2*cm, 10*cm, 2.5*cm, 2.5*cm])
        t_steps.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.grey),
            ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 5),
            ('RIGHTPADDING', (0,0), (-1,-1), 5),
        ]))
        story.append(t_steps)
    else:
        story.append(Paragraph("No specific navigation instructions found for this route.", style_norm))
        
    story.append(PageBreak())
    
    # --- 5. POI DETAILS ---
    for idx, poi in enumerate(pois):
        p_name = html.escape(poi.get('name', 'POI'))
        address = html.escape(poi.get('address', ''))
        story.append(Paragraph(f"{idx+1}. {p_name}", style_h2))
        story.append(Paragraph(address, style_small))
        story.append(Spacer(1, 0.5*cm))
        
        # Description Priority (Long -> Short -> Desc)
        desc = poi.get('long_description') or poi.get('standard_description') or \
               poi.get('short_description') or poi.get('description', '')
        
        story.append(Paragraph(html.escape(desc), style_norm))
        story.append(Spacer(1, 0.5*cm))
        
        # Images (Scrape up to 3)
        print(f"Processing images for POI: {p_name}...")
        valid_images = scrape_images(poi, city, max_count=3)
        print(f"Downloaded {len(valid_images)} photos for POI: {p_name}")
        
        if valid_images:
            for im_path in valid_images:
                try:
                    img_obj = Image.open(im_path)
                    aspect = img_obj.height / img_obj.width
                    d_width = 16*cm
                    d_height = d_width * aspect
                    
                    if d_height > 9*cm:
                        d_height = 9*cm
                        d_width = d_height / aspect
                        
                    story.append(RLImage(im_path, width=d_width, height=d_height))
                    story.append(Spacer(1, 0.5*cm))
                except Exception as e:
                    story.append(Paragraph(f"[Image Error: {e}]", style_small))
        else:
            # Fallback: QR Code
            fallback_q = f"{poi.get('name', 'POI')} {city}"
            link = poi.get('link') or f"https://www.google.com/search?q={fallback_q}"
            qr_path = generate_qr(link, f"poi_{idx}")
            story.append(Spacer(1, 1*cm))
            story.append(RLImage(qr_path, width=4*cm, height=4*cm))
            esc_link = html.escape(link)
            story.append(Paragraph(f'<a href="{esc_link}">Link to info</a>', style_small))

        story.append(Spacer(1, 1*cm))
        # Coordinates
        p_lat, p_lng = extract_coords(poi)
        story.append(Paragraph(f"Lat: {p_lat:.5f}, Lng: {p_lng:.5f}", style_small))
        
        story.append(PageBreak())

    # Build PDF
    doc = SimpleDocTemplate(
        out_file,
        pagesize=A4,
        rightMargin=MARGIN_H,
        leftMargin=MARGIN_H,
        topMargin=MARGIN_TOP,
        bottomMargin=MARGIN_BOTTOM
    )
    
    doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
    
    # Validation
    file_size = os.path.getsize(out_file)
    print(f"Success: Generated {out_file} ({file_size / 1024:.1f} KB)")
    
    if file_size < 60 * 1024:
        print("Warning: PDF file size is smaller than 60KB. Check for missing content.")
    else:
        print("Validation Passed: PDF size is healthy (> 60KB).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Generate Travel Booklet PDF')
    parser.add_argument('json_file', help='Path to route JSON file')
    parser.add_argument('--logo', help='Path to logo image', default='cityexplorer.png')
    parser.add_argument('--outfile', help='Output filename', default='Travel_Booklet.pdf')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.json_file):
        print(f"Error: JSON file not found: {args.json_file}")
        sys.exit(1)
        
    build_pdf(args.json_file, args.logo, args.outfile)
