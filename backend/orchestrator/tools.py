"""
LangChain Tools — formula calculators and domain-specific utilities.
Each function is registered as a @tool so the orchestrator can call them automatically.
"""
import math
from langchain_core.tools import tool


# ── Condus ────────────────────────────────────────────────────────────────────
@tool
def distanta_oprire(viteza_kmh: float, tip_carosabil: str = "uscat", timp_reactie_s: float = 0.8) -> dict:
    """Calculeaza distanta totala de oprire: reactie + franare.
    tip_carosabil: uscat | umed | gheata | zapada
    """
    coef = {"uscat": 0.8, "umed": 0.5, "gheata": 0.15, "zapada": 0.25}
    mu = coef.get(tip_carosabil.lower(), 0.8)
    v_ms = viteza_kmh / 3.6
    d_reactie = v_ms * timp_reactie_s
    d_franare = (v_ms ** 2) / (2 * 9.81 * mu)
    d_total = d_reactie + d_franare
    return {
        "viteza_kmh": viteza_kmh,
        "tip_carosabil": tip_carosabil,
        "distanta_reactie_m": round(d_reactie, 2),
        "distanta_franare_m": round(d_franare, 2),
        "distanta_totala_m": round(d_total, 2),
        "formula": f"d_total = v*t_reactie + v²/(2*g*μ) = {round(d_reactie,2)} + {round(d_franare,2)} = {round(d_total,2)} m",
    }


# ── Constructii ───────────────────────────────────────────────────────────────
@tool
def calcul_volum_beton(lungime_m: float, latime_m: float, grosime_m: float) -> dict:
    """Calculeaza volumul de beton necesar pentru o placa / fundatie."""
    volum = lungime_m * latime_m * grosime_m
    volum_plus_risipa = volum * 1.05
    return {
        "volum_net_m3": round(volum, 3),
        "volum_recomandat_m3": round(volum_plus_risipa, 3),
        "formula": f"{lungime_m} × {latime_m} × {grosime_m} = {round(volum, 3)} m³ (+5% risipă = {round(volum_plus_risipa,3)} m³)",
    }


@tool
def necesar_materiale_beton(volum_m3: float, clasa_beton: str = "C20/25") -> dict:
    """Calculeaza cantitatile de ciment, nisip, pietris si apa pentru volumul dat."""
    retete = {
        "C16/20": {"ciment_kg": 280, "nisip_kg": 780, "pietris_kg": 1050, "apa_l": 185},
        "C20/25": {"ciment_kg": 320, "nisip_kg": 760, "pietris_kg": 1030, "apa_l": 180},
        "C25/30": {"ciment_kg": 370, "nisip_kg": 720, "pietris_kg": 1010, "apa_l": 175},
        "C30/37": {"ciment_kg": 420, "nisip_kg": 680, "pietris_kg": 980, "apa_l": 170},
    }
    reteta = retete.get(clasa_beton.upper(), retete["C20/25"])
    return {
        "clasa_beton": clasa_beton,
        "volum_m3": volum_m3,
        "ciment_kg": round(reteta["ciment_kg"] * volum_m3, 1),
        "nisip_kg": round(reteta["nisip_kg"] * volum_m3, 1),
        "pietris_kg": round(reteta["pietris_kg"] * volum_m3, 1),
        "apa_l": round(reteta["apa_l"] * volum_m3, 1),
    }


@tool
def grosime_placa_beton(deschidere_m: float, sarcina_kpa: float = 2.0) -> dict:
    """Estimeaza grosimea minima a placii de beton pentru deschiderea si sarcina date."""
    grosime_cm = (deschidere_m * 100) / 30 + sarcina_kpa * 1.5
    return {
        "deschidere_m": deschidere_m,
        "sarcina_kpa": sarcina_kpa,
        "grosime_minima_cm": round(grosime_cm, 1),
        "grosime_recomandata_cm": round(grosime_cm * 1.1, 1),
        "formula": f"L/30 + sarcina×1.5 = {round(grosime_cm,1)} cm",
    }


# ── Maritim ───────────────────────────────────────────────────────────────────
@tool
def calcul_eta(distanta_mile: float, viteza_noduri: float, curent_noduri: float = 0.0) -> dict:
    """Calculeaza ETA (timp estimat de sosire) pentru o ruta maritima."""
    viteza_efectiva = viteza_noduri + curent_noduri
    if viteza_efectiva <= 0:
        return {"eroare": "Viteza efectiva zero sau negativa — nava nu avanseaza."}
    ore = distanta_mile / viteza_efectiva
    ore_int = int(ore)
    minute = int((ore - ore_int) * 60)
    return {
        "distanta_mile": distanta_mile,
        "viteza_noduri": viteza_noduri,
        "curent_noduri": curent_noduri,
        "viteza_efectiva_noduri": round(viteza_efectiva, 2),
        "durata_ore": ore_int,
        "durata_minute": minute,
        "durata_text": f"{ore_int}h {minute}min",
        "formula": f"t = d/v = {distanta_mile}/{round(viteza_efectiva,2)} = {round(ore,2)} ore",
    }


@tool
def conversie_noduri_kmh(noduri: float) -> dict:
    """Converteste viteza din noduri in km/h si m/s."""
    kmh = noduri * 1.852
    ms = noduri * 0.5144
    return {
        "noduri": noduri,
        "km_h": round(kmh, 2),
        "m_s": round(ms, 3),
    }


@tool
def deplasament_nava(lungime_m: float, latime_m: float, pescaj_m: float, coef_bloc: float = 0.65) -> dict:
    """Calculeaza deplasamentul aproximativ al navei (tonaj)."""
    volum = lungime_m * latime_m * pescaj_m * coef_bloc
    deplasament_tone = volum * 1.025
    return {
        "volum_m3": round(volum, 2),
        "deplasament_tone": round(deplasament_tone, 2),
        "formula": f"L×B×T×Cb×ρ = {lungime_m}×{latime_m}×{pescaj_m}×{coef_bloc}×1.025 = {round(deplasament_tone,2)} t",
    }


# ── Design Interior ───────────────────────────────────────────────────────────
@tool
def necesar_tapet(lungime_perete_m: float, inaltime_camera_m: float, latime_rola_m: float = 0.53, lungime_rola_m: float = 10.05) -> dict:
    """Calculeaza numarul de role de tapet necesare pentru un perete."""
    arie_perete = lungime_perete_m * inaltime_camera_m
    arie_rola = latime_rola_m * lungime_rola_m
    role_nete = arie_perete / arie_rola
    role_recomandate = math.ceil(role_nete * 1.10)
    return {
        "arie_perete_m2": round(arie_perete, 2),
        "role_minime": math.ceil(role_nete),
        "role_recomandate": role_recomandate,
        "formula": f"Arie/{round(arie_rola,2)} = {round(role_nete,2)} → recomandat {role_recomandate} role (+10%)",
    }


@tool
def schema_culori_60_30_10(culoare_dominanta: str, culoare_secundara: str = "neutru", culoare_accent: str = "accent") -> dict:
    """Genereaza schema de culori 60-30-10 pentru o incapere."""
    return {
        "regula": "60% - 30% - 10%",
        "culoare_60_procente": {"culoare": culoare_dominanta, "utilizare": "Pereti principali, podea, mobilier mare"},
        "culoare_30_procente": {"culoare": culoare_secundara, "utilizare": "Mobilier secundar, draperii, covoare"},
        "culoare_10_procente": {"culoare": culoare_accent, "utilizare": "Perne decorative, tablouri, accesorii"},
        "sfat": "Culoarea dominanta trebuie sa fie cea mai linistita, accentul poate fi vibrant.",
    }


@tool
def necesar_parchet(lungime_m: float, latime_m: float) -> dict:
    """Calculeaza necesarul de parchet pentru o camera."""
    arie = lungime_m * latime_m
    arie_plus_risipa = arie * 1.08
    return {
        "arie_camera_m2": round(arie, 2),
        "arie_comanda_m2": round(arie_plus_risipa, 2),
        "formula": f"{lungime_m}×{latime_m} = {round(arie,2)} m² (+8% tăieturi = {round(arie_plus_risipa,2)} m²)",
    }


# ── Educatie ──────────────────────────────────────────────────────────────────
@tool
def planificare_sesiune_spatiala(concept: str, data_prima_studiere: str) -> dict:
    """Calculeaza datele urmatoarele sesiuni de repetitie spatata Ebbinghaus."""
    from datetime import datetime, timedelta
    try:
        data = datetime.strptime(data_prima_studiere, "%Y-%m-%d")
    except ValueError:
        data = datetime.now()
    intervale = [1, 3, 7, 21, 60]
    sesiuni = [{"sesiune": i + 1, "data": (data + timedelta(days=d)).strftime("%Y-%m-%d"), "zile_de_la_start": d}
               for i, d in enumerate(intervale)]
    return {"concept": concept, "prima_studiere": data.strftime("%Y-%m-%d"), "sesiuni_repetitie": sesiuni}


# ── 3D Printing ───────────────────────────────────────────────────────────────
@tool
def calcul_filament(volum_model_cm3: float, tip_filament: str = "PLA", infill_procent: float = 20.0) -> dict:
    """Calculeaza cantitatea de filament necesara pentru un model 3D.
    tip_filament: PLA | PETG | ABS | TPU
    infill_procent: 0-100
    """
    densitati = {"PLA": 1.24, "PETG": 1.27, "ABS": 1.04, "TPU": 1.21}
    densitate = densitati.get(tip_filament.upper(), 1.24)
    factor_infill = 0.3 + (infill_procent / 100) * 0.7
    volum_real = volum_model_cm3 * factor_infill
    masa_grame = volum_real * densitate
    lungime_mm = (masa_grame / (densitate * math.pi * 0.875 ** 2)) * 1000
    return {
        "volum_model_cm3": volum_model_cm3,
        "tip_filament": tip_filament,
        "infill_procent": infill_procent,
        "masa_filament_g": round(masa_grame, 2),
        "lungime_filament_mm": round(lungime_mm, 1),
        "formula": f"masă = {round(volum_real,3)} cm³ × {densitate} g/cm³ = {round(masa_grame,2)} g",
    }


@tool
def timp_printare_3d(volum_cm3: float, viteza_mm_s: float = 50, layer_height_mm: float = 0.2) -> dict:
    """Estimeaza timpul de printare 3D pentru un model."""
    factor = 1200 / (viteza_mm_s * layer_height_mm)
    timp_minute = volum_cm3 * factor / 60
    ore = int(timp_minute // 60)
    minute = int(timp_minute % 60)
    return {
        "volum_cm3": volum_cm3,
        "viteza_mm_s": viteza_mm_s,
        "layer_height_mm": layer_height_mm,
        "timp_estimat_ore": ore,
        "timp_estimat_minute": minute,
        "timp_text": f"~{ore}h {minute}min",
        "formula": f"t ≈ V × 1200 / (v × h) = {round(timp_minute,1)} min",
    }


@tool
def setari_print_recomandate(material: str, utilizare: str = "functional") -> dict:
    """Returneaza setarile recomandate pentru printare 3D in functie de material si utilizare.
    material: PLA | PETG | ABS | TPU
    utilizare: decorativ | functional | rezistent
    """
    profiles = {
        "PLA": {
            "decorativ":  {"temp_nozzle": 200, "temp_bed": 60,  "viteza": 60, "infill": 15, "layer": 0.2},
            "functional": {"temp_nozzle": 210, "temp_bed": 60,  "viteza": 50, "infill": 30, "layer": 0.2},
            "rezistent":  {"temp_nozzle": 215, "temp_bed": 60,  "viteza": 40, "infill": 50, "layer": 0.15},
        },
        "PETG": {
            "decorativ":  {"temp_nozzle": 230, "temp_bed": 75,  "viteza": 45, "infill": 20, "layer": 0.2},
            "functional": {"temp_nozzle": 235, "temp_bed": 80,  "viteza": 40, "infill": 40, "layer": 0.2},
            "rezistent":  {"temp_nozzle": 240, "temp_bed": 85,  "viteza": 35, "infill": 60, "layer": 0.15},
        },
        "ABS": {
            "decorativ":  {"temp_nozzle": 240, "temp_bed": 100, "viteza": 50, "infill": 20, "layer": 0.2},
            "functional": {"temp_nozzle": 245, "temp_bed": 105, "viteza": 45, "infill": 40, "layer": 0.2},
            "rezistent":  {"temp_nozzle": 250, "temp_bed": 110, "viteza": 40, "infill": 60, "layer": 0.15},
        },
    }
    profile = profiles.get(material.upper(), profiles["PLA"]).get(utilizare.lower(), profiles["PLA"]["functional"])
    return {"material": material, "utilizare": utilizare, **profile,
            "sfat": f"Temperatura nozzle: {profile['temp_nozzle']}°C | Pat: {profile['temp_bed']}°C | Infill: {profile['infill']}%"}


# ── 3D Modeling ───────────────────────────────────────────────────────────────
@tool
def calcul_rezolutie_render(latime_px: int, inaltime_px: int, samples: int = 128) -> dict:
    """Estimeaza timpul de render pentru o imagine 3D (Blender Cycles)."""
    megapixeli = (latime_px * inaltime_px) / 1_000_000
    timp_s = megapixeli * samples * 0.15
    return {
        "rezolutie": f"{latime_px}×{inaltime_px}",
        "megapixeli": round(megapixeli, 2),
        "samples": samples,
        "timp_estimat_s": round(timp_s, 1),
        "timp_text": f"~{int(timp_s//60)}min {int(timp_s%60)}s",
        "formula": f"t ≈ {round(megapixeli,2)} MP × {samples} samples × 0.15 = {round(timp_s,1)}s",
    }


@tool
def conversie_unitati_3d(valoare: float, din: str, in_: str) -> dict:
    """Converteste unitati de masura folosite in 3D modeling.
    din/in_: mm | cm | m | inch | feet | blender_unit
    """
    to_mm = {"mm": 1, "cm": 10, "m": 1000, "inch": 25.4, "feet": 304.8, "blender_unit": 1000}
    if din not in to_mm or in_ not in to_mm:
        return {"eroare": f"Unitati necunoscute: {din}, {in_}"}
    result = valoare * to_mm[din] / to_mm[in_]
    return {
        "valoare_initiala": valoare,
        "din": din,
        "in": in_,
        "rezultat": round(result, 6),
        "formula": f"{valoare} {din} = {round(result, 6)} {in_}",
    }


@tool
def poly_count_estimare(tip_obiect: str, detaliu: str = "mediu") -> dict:
    """Estimeaza numarul de poligoane recomandat pentru diferite tipuri de obiecte 3D.
    tip_obiect: personaj | vehicul | cladire | prop | teren
    detaliu: scazut | mediu | inalt | cinematic
    """
    counts = {
        "personaj":  {"scazut": 1500,    "mediu": 10000,   "inalt": 50000,   "cinematic": 200000},
        "vehicul":   {"scazut": 3000,    "mediu": 15000,   "inalt": 60000,   "cinematic": 250000},
        "cladire":   {"scazut": 500,     "mediu": 5000,    "inalt": 20000,   "cinematic": 80000},
        "prop":      {"scazut": 200,     "mediu": 1000,    "inalt": 5000,    "cinematic": 20000},
        "teren":     {"scazut": 1000,    "mediu": 10000,   "inalt": 100000,  "cinematic": 500000},
    }
    count = counts.get(tip_obiect.lower(), counts["prop"]).get(detaliu.lower(), 1000)
    return {
        "tip_obiect": tip_obiect,
        "detaliu": detaliu,
        "poly_count_recomandat": count,
        "sfat": f"Pentru {tip_obiect} la nivel {detaliu}: ~{count:,} poligoane.",
    }


ALL_TOOLS = [
    distanta_oprire,
    calcul_volum_beton,
    necesar_materiale_beton,
    grosime_placa_beton,
    calcul_eta,
    conversie_noduri_kmh,
    deplasament_nava,
    necesar_tapet,
    schema_culori_60_30_10,
    necesar_parchet,
    planificare_sesiune_spatiala,
    calcul_filament,
    timp_printare_3d,
    setari_print_recomandate,
    calcul_rezolutie_render,
    conversie_unitati_3d,
    poly_count_estimare,
]
