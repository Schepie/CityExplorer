# Scaling Strategie: Omgaan met API Limieten

Het automatisch aanmaken van accounts/keys voor gebruikers (zoals een nieuwe Groq of Tavily key per gebruiker) is technisch meestal niet mogelijk en vaak in strijd met de Gebruiksvoorwaarden (ToS) van de providers.

Hieronder staan de drie beste alternatieven voor een publieke App Store release.

---

## 1. BYOK Model (Bring Your Own Key)
In deze opzet kan de gebruiker in het instellingenmenu zijn eigen API-sleutels invoeren.

*   **Hoe het werkt**: De app vraagt bij de eerste keer opstarten of in "Instellingen" om een eigen Groq of Gemini key.
*   **Voordelen**: 
    *   Oneindig schaalbaar: De kosten en limieten liggen bij de eindgebruiker.
    *   App blijft "gratis" voor jou als ontwikkelaar.
*   **Nadelen**: 
    *   Hoge drempel voor "normale" gebruikers.
    *   Niet geschikt voor een massa-publiek.

## 2. Het "Proxy & Quota" Model (De Professionele Aanpak)
Je behoudt de centrale keys op de server (Netlify), maar stelt limieten in per gebruiker.

*   **Hoe het werkt**: 
    *   Gebruikers moeten inloggen (zit al in de app met AuthContext).
    *   Elke gebruiker krijgt een "budget" (bijv. 10 AI-verzoeken per dag).
    *   Resultaten worden agressief gecached (als Gebruiker A een route door Hasselt doet, hoeft Gebruiker B de AI niet opnieuw aan te roepen voor dezelfde POI's).
*   **Voordelen**: Beste UX (gebruiker merkt niets).
*   **Nadelen**: Je moet zelf de limieten van je "global keys" monitoren.

## 3. Multi-Provider Fallback (Aggregatie)
In plaats van één bron, spreidt je de belasting over alle beschikbare gratis diensten.

*   **Hoe het werkt**: 
    1. Probeer Groq (Llama).
    2. Indien Rate Limit (429) -> Schakel over naar Gemini 2.0 Flash.
    3. Indien ook over limiet -> Schakel over naar een lokale (kleinere) AI of een simpele Wikipedia-samenvatting.
*   **Voordelen**: Verhoogt de totale capaciteit zonder kosten.

---

## 4. Kaart Schaalbaarheid (MapTiler/Google)
Kaarttegels zijn de grootste "verbruikers" omdat elke beweging op de kaart nieuwe data ophaalt.

*   **OpenFreeMap (Standaard)**: De app is standaard geconfigureerd om `tiles.openfreemap.org` te gebruiken. Dit werkt volledig gratis en zonder keys, wat ideaal is voor een App Store release.
*   **Beperkt MapTiler Gebruik**: MapTiler wordt alleen nog gebruikt voor satellietbeelden, waardoor je veel minder snel tegen de gratis limieten aanloopt.

---

## 💡 Advies voor de App Store

Mijn advies zou een **hybride aanpak** zijn:
1.  **Agressieve Caching**: Sla alle AI-antwoorden op in een Cloud Database (bijv. Supabase of Firebase). Als 100 mensen door Antwerpen lopen, hoef je de AI maar 1x per POI te betalen/aan te roepen.
2.  **Freemium/BYOK**: De eerste 5 trips zijn gratis onder jouw keys. Daarna vraagt de app de gebruiker om een eigen key of een kleine bijdrage.
3.  **Tavily/Foursquare Fallback**: Gebruik Wikipedia als primaire bron voor tekst (gratis/onbeperkt) en gebruik de dure AI-bronnen alleen voor "Extra Fun Facts".

Zal ik een plan maken om de **"Bring Your Own Key"** optie technisch toe te voegen aan het instellingenmenu?
