# Hoe werkt het "POI Toevoegen" Algoritme?

Dit document legt op een eenvoudige manier uit wat er "onder de motorkap" gebeurt wanneer je in CityExplorer kiest om nieuwe bezienswaardigheden (POI's) aan je bestaande route toe te voegen.

Het proces bestaat uit **4 logische stappen**:

## 1. Filteren & Selecteren
Allereerst kijkt het systeem naar de nieuwe locaties die gevonden zijn.
*   **Dubbels checken:** Als een plek al in je huidige route zit, wordt deze direct genegeerd.
*   **De besten kiezen:** Uit de nieuwe resultaten nemen we de **top 3** beste matches (op basis van relevantie en populariteit).

## 2. De Route Puzzel (Optimalisatie)
Nu we een mix hebben van je *oude* plekken en de *nieuwe* plekken, moet de computer een logische volgorde bepalen. Hij doet dit niet willekeurig, maar gebruikt een slimme methode (een variatie op het 'Handelsreizigersprobleem'):

1.  Hij begint bij het **startpunt** (bijv. het centrum of je huidige locatie).
2.  Hij kijkt naar **alle** plekken (oud én nieuw) die nog bezocht moeten worden.
3.  Hij kiest de plek die **het dichtstbij** is.
4.  Vanuit die nieuwe plek kijkt hij weer wat *daar* het dichtstbij ligt.
5.  Dit herhaalt hij tot alle plekken aan elkaar geregen zijn.

> **In mensentaal:** Hij verbindt de punten zo efficiënt mogelijk zodat je niet onnodig heen en weer loopt.

## 3. Echte Afstand Berekenen
De computer verbindt de punten niet met rechte lijnen (vogelvlucht), maar berekent de route via de **echte straten en paden** (gebruikmakend van OpenStreetMap data).
*   Hierdoor weten we de **echte afstand** en wandeltijd.

## 4. De "Budget" Check
Als laatste stap controleert het systeem of deze nieuwe route nog wel binnen jouw wensen past.
*   **De Limiet:** Heb je ingesteld dat je max 5 km wilt wandelen?
*   **De Tolerantie:** We rekenen met een marge van **15%**. (Dus 5km mag stiekem 5.75km worden).

**De uitkomst:**
*   **Past het?** De route wordt direct aangepast en getoond op de kaart.
*   **Is het te lang?** De AI (Brain) geeft een melding: *"Deze toevoeging maakt de reis X km. Je limiet is Y km. Wil je doorgaan?"*. Jij hebt dan de keuze om te accepteren of te annuleren.
