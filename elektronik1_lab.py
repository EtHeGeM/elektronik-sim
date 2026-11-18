#!/usr/bin/env python3
"""
Elektronik I (ELM2021) — Marmara Üni. Mekatronik Mühendisliği
Vize Çalışma, Metot Anlatım, SymPy/NumPy Doğrulama ve Yerel Sunucu Aracı.

Kullanım:
  python3 elektronik1_lab.py --test     # Tüm vize soru tiplerini çözer ve doğrular
  python3 elektronik1_lab.py --serve    # Web laboratuvarını http://127.0.0.1:8765 adresinde açar
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
import socketserver
from typing import Dict, Tuple

import numpy as np
import sympy as sp


def solve_parallel_diodes(e_val: float, r_kohm: float, vk1: float, vk2: float) -> Dict[str, float | str]:
    """Paralel bağlı iki diyot (D1 || D2) için en küçük eşik gerilimi kuralıyla çözüm."""
    vmin = min(vk1, vk2)
    if e_val <= vmin:
        return {"Vo": e_val, "Ir_mA": 0.0, "Id1_mA": 0.0, "Id2_mA": 0.0, "durum": "D1=OFF, D2=OFF"}
    if abs(vk1 - vk2) < 1e-9:
        vo = vk1
        ir = (e_val - vo) / r_kohm
        return {"Vo": vo, "Ir_mA": ir, "Id1_mA": ir / 2, "Id2_mA": ir / 2, "durum": "D1=ON, D2=ON"}
    if vk1 < vk2:
        vo = vk1
        ir = (e_val - vo) / r_kohm
        return {"Vo": vo, "Ir_mA": ir, "Id1_mA": ir, "Id2_mA": 0.0, "durum": "D1=ON, D2=OFF"}
    vo = vk2
    ir = (e_val - vo) / r_kohm
    return {"Vo": vo, "Ir_mA": ir, "Id1_mA": 0.0, "Id2_mA": ir, "durum": "D1=OFF, D2=ON"}


def solve_clipper_series(vm: float, vdc: float, vk: float, direction: str = "forward") -> Dict[str, float]:
    """Seri kırpıcı devre için geçiş gerilimi ve çıkış sınırları."""
    t_grid = np.linspace(0.0, 1.0, 500)
    vi = vm * np.sin(2.0 * np.pi * t_grid)
    if direction == "forward":
        v_trans = vk - vdc
        vo = np.where(vi > v_trans, vi - vk + vdc, 0.0)
    else:
        v_trans = -vk - vdc
        vo = np.where(vi < v_trans, vi + vk + vdc, 0.0)
    return {
        "V_gecis": float(v_trans),
        "Vo_max": float(np.max(vo)),
        "Vo_min": float(np.min(vo)),
    }


def solve_clamper(vm: float, vdc: float, vk: float, direction: str = "up") -> Dict[str, float]:
    """Kenetleyici (clamper) devre için kondansatör gerilimi ve çıkış tepeleri."""
    if direction == "down":
        v_clamp = vdc + vk
        vc = vm - v_clamp if vm > v_clamp else 0.0
    else:
        v_clamp = vdc - vk
        vc = -vm - v_clamp if -vm < v_clamp else 0.0
    vo_max = vm - vc
    vo_min = -vm - vc
    return {"Vc": vc, "Vo_max": vo_max, "Vo_min": vo_min, "Delta_Vo": vo_max - vo_min}


def solve_zener_regulator(vi: float, rs_ohm: float, vz: float, pzm_mw: float, rl_ohm: float) -> Dict[str, float | str]:
    """Zener regülatör 3 adımlı analiz ve RL(min), Vi(min), Vi(max) sınır hesabı."""
    vth = vi * (rl_ohm / (rs_ohm + rl_ohm))
    izm_ma = pzm_mw / vz
    if vth >= vz:
        durum = "ON (Regülasyon Aktif)"
        vl = vz
        ir_ma = ((vi - vz) / rs_ohm) * 1000.0
        il_ma = (vz / rl_ohm) * 1000.0
        iz_ma = ir_ma - il_ma
        pz_mw = vz * iz_ma
    else:
        durum = "OFF (Kesimde)"
        vl = vth
        ir_ma = (vi / (rs_ohm + rl_ohm)) * 1000.0
        il_ma = ir_ma
        iz_ma = 0.0
        pz_mw = 0.0

    rl_min = (rs_ohm * vz) / (vi - vz) if vi > vz else float("inf")
    vi_min = vz * (rs_ohm + rl_ohm) / rl_ohm
    vi_max = vz + rs_ohm * (izm_ma + (vz / rl_ohm) * 1000.0) / 1000.0
    return {
        "Vth": vth,
        "durum": durum,
        "VL": vl,
        "Iz_mA": iz_ma,
        "Pz_mW": pz_mw,
        "RL_min_ohm": rl_min,
        "Vi_min": vi_min,
        "Vi_max": vi_max,
    }


def solve_bjt_divider_sympy(
    vcc: float, r1_k: float, r2_k: float, rc_k: float, re_k: float, beta: float, vbe: float = 0.7, vce_sat: float = 0.2
) -> Dict[str, float | str | bool]:
    """Gerilim bölücülü BJT devresini SymPy ile tam (Thévenin) ve Yaklaşık yöntemle çözer."""
    approx_ok = (beta * re_k) >= (10.0 * r2_k)
    rth = (r1_k * r2_k) / (r1_k + r2_k)
    eth = vcc * (r2_k / (r1_k + r2_k))

    ib_sym, ic_sym = sp.symbols("ib ic", real=True)
    # Aktif bölge çözümü
    ib_active = float((eth - vbe) / (rth + (beta + 1.0) * re_k))
    ic_active = beta * ib_active
    ie_active = (beta + 1.0) * ib_active
    vce_active = vcc - ic_active * rc_k - ie_active * re_k

    if eth <= vbe:
        bolge = "KESİM"
        ib_val, ic_val, vce_val = 0.0, 0.0, vcc
    elif vce_active <= vce_sat:
        bolge = "DOYUM (Saturation)"
        eq1 = sp.Eq((rth + re_k) * ib_sym + re_k * ic_sym, eth - vbe)
        eq2 = sp.Eq(re_k * ib_sym + (rc_k + re_k) * ic_sym, vcc - vce_sat)
        sol = sp.solve((eq1, eq2), (ib_sym, ic_sym))
        ib_val = float(sol[ib_sym])
        ic_val = float(sol[ic_sym])
        vce_val = vce_sat
    else:
        bolge = "İLERİ AKTİF"
        ib_val, ic_val, vce_val = ib_active, ic_active, vce_active

    # Yaklaşık Yöntem
    vb_approx = eth
    ic_approx = max(0.0, (vb_approx - vbe) / re_k)
    vce_approx = max(vce_sat, vcc - ic_approx * (rc_k + re_k))

    return {
        "approx_ok": approx_ok,
        "Rth_k": rth,
        "Eth_V": eth,
        "bolge": bolge,
        "Ib_uA": ib_val * 1000.0,
        "Ic_mA": ic_val,
        "Vce_V": vce_val,
        "Ic_approx_mA": ic_approx,
        "Vce_approx_V": vce_approx,
    }


def solve_bjt_fixed_sympy(
    vcc: float, rb_k: float, rc_k: float, beta: float, vbe: float = 0.7, vce_sat: float = 0.2
) -> Dict[str, float | str]:
    """Sabit öngerilimli BJT devresi (Doyum kontrolü dahil)."""
    ib = max(0.0, (vcc - vbe) / rb_k)
    ic_act = beta * ib
    vce_act = vcc - ic_act * rc_k
    if vce_act <= vce_sat:
        return {
            "bolge": "DOYUM (Saturation)",
            "Ib_uA": ib * 1000.0,
            "Ic_mA": (vcc - vce_sat) / rc_k,
            "Vce_V": vce_sat,
            "Vce_aktif_deneme": vce_act,
        }
    return {
        "bolge": "İLERİ AKTİF",
        "Ib_uA": ib * 1000.0,
        "Ic_mA": ic_act,
        "Vce_V": vce_act,
        "Vce_aktif_deneme": vce_act,
    }


def run_tests() -> None:
    """Tüm vize soru tiplerini çalıştırır, doğrular ve sonuçları yazdırır."""
    print("=" * 74)
    print("ELEKTRONİK I (ELM2021) — VİZE SORU TİPLERİ NUMPY/SYMPY DOĞRULAMASI")
    print("=" * 74)

    # 1. Paralel Diyot
    r1 = solve_parallel_diodes(e_val=12.0, r_kohm=0.33, vk1=0.7, vk2=0.3)
    assert abs(float(r1["Vo"]) - 0.3) < 1e-6 and abs(float(r1["Id2_mA"]) - (11.7 / 0.33)) < 1e-4
    print(f"\n[Modül 1 - Paralel Si // Ge Diyot (E=12V, R=0.33kΩ)]")
    print(f"  Durum: {r1['durum']} | Vo = {r1['Vo']:.2f} V | I_D1 = {r1['Id1_mA']:.2f} mA | I_D2 = {r1['Id2_mA']:.2f} mA")

    # 2. Seri Kırpıcı
    r2 = solve_clipper_series(vm=20.0, vdc=5.0, vk=0.0, direction="forward")
    assert abs(r2["V_gecis"] - (-5.0)) < 1e-6 and abs(r2["Vo_max"] - 25.0) < 0.05
    print(f"\n[Modül 2a - Seri Kırpıcı (Vm=20V, Vdc=+5V, İdeal)]")
    print(f"  Geçiş Vi = {r2['V_gecis']:.2f} V | Vo(max) = {r2['Vo_max']:.2f} V | Vo(min) = {r2['Vo_min']:.2f} V")

    # 3. Kenetleyici
    r3 = solve_clamper(vm=20.0, vdc=5.0, vk=0.7, direction="up")
    assert abs(r3["Vo_min"] - 4.3) < 1e-6 and abs(r3["Vo_max"] - 44.3) < 1e-6 and abs(r3["Delta_Vo"] - 40.0) < 1e-6
    print(f"\n[Modül 2b - Kare Dalgalı Kenetleyici (Vm=20V, Vdc=+5V, Yukarı Si)]")
    print(f"  Vc = {r3['Vc']:.2f} V | Vo(min) = {r3['Vo_min']:.2f} V | Vo(max) = {r3['Vo_max']:.2f} V | ΔVo = {r3['Delta_Vo']:.2f} V")

    # 4. Zener Regülatör (Boylestad 2.26 a & b)
    r4a = solve_zener_regulator(vi=16.0, rs_ohm=1000.0, vz=10.0, pzm_mw=300.0, rl_ohm=1200.0)
    r4b = solve_zener_regulator(vi=16.0, rs_ohm=1000.0, vz=10.0, pzm_mw=300.0, rl_ohm=3000.0)
    assert r4a["VL"] < 10.0 and abs(float(r4b["VL"]) - 10.0) < 1e-6
    print(f"\n[Modül 3 - Zener Regülatör (Vi=16V, Rs=1kΩ, Vz=10V)]")
    print(f"  RL=1.2kΩ -> Vth={r4a['Vth']:.2f}V -> {r4a['durum']} | VL={r4a['VL']:.2f}V | RL(min)={r4a['RL_min_ohm']:.1f}Ω")
    print(f"  RL=3.0kΩ -> Vth={r4b['Vth']:.2f}V -> {r4b['durum']} | VL={r4b['VL']:.2f}V | Iz={r4b['Iz_mA']:.2f}mA | Pz={r4b['Pz_mW']:.1f}mW")

    # 5. BJT Gerilim Bölücü (Thévenin vs Yaklaşık)
    r5 = solve_bjt_divider_sympy(vcc=18.0, r1_k=82.0, r2_k=22.0, rc_k=5.6, re_k=1.2, beta=50.0)
    assert r5["approx_ok"] is False and r5["bolge"] == "İLERİ AKTİF"
    print(f"\n[Modül 4a - BJT Gerilim Bölücü (Boylestad 4.10: Şart Sağlanmaz)]")
    print(f"  Yaklaşık Şartı (β·RE ≥ 10·R2): {r5['approx_ok']} | Rth={r5['Rth_k']:.2f}kΩ, Eth={r5['Eth_V']:.2f}V")
    print(f"  Tam Çözüm: {r5['bolge']} | Ib={r5['Ib_uA']:.1f}µA | Ic={r5['Ic_mA']:.2f}mA | Vce={r5['Vce_V']:.2f}V")
    print(f"  (Yaklaşık kullanılsaydı: Ic≈{r5['Ic_approx_mA']:.2f}mA, Vce≈{r5['Vce_approx_V']:.2f}V olurdu)")

    # 6. BJT Doyum Tuzağı
    r6 = solve_bjt_fixed_sympy(vcc=12.0, rb_k=47.0, rc_k=4.7, beta=100.0)
    assert r6["bolge"] == "DOYUM (Saturation)" and abs(float(r6["Vce_V"]) - 0.2) < 1e-6
    print(f"\n[Modül 4b - BJT Sabit Polarma Doyum Tuzağı (Vcc=12V, Rb=47kΩ, Rc=4.7kΩ, β=100)]")
    print(f"  Aktif denemede Vce={r6['Vce_aktif_deneme']:.2f}V ≤ 0.2V ⇒ {r6['bolge']} | Ic(sat)={r6['Ic_mA']:.2f}mA | Vce={r6['Vce_V']:.2f}V")
    print("\n" + "=" * 74)
    print("TÜM DOĞRULAMA TESTLERİ BAŞARIYLA GEÇTİ ✓")
    print("=" * 74)


def serve_web(port: int = 8765) -> None:
    """Çalışma dizinindeki web simülatörünü yerel HTTP sunucusuyla sunar."""
    root_dir = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root_dir)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Elektronik I Vize Laboratuvarı çalışıyor: http://127.0.0.1:{port}/index.html")
        print("Durdurmak için Ctrl+C tuşlarına basın.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nSunucu kapatıldı.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Elektronik I (ELM2021) Vize Çalışma & SPICE Doğrulama Aracı")
    parser.add_argument("--test", action="store_true", help="Tüm örnek vize sorularını NumPy/SymPy ile çözüp doğrular.")
    parser.add_argument("--serve", action="store_true", help="İnteraktif web laboratuvarını yerel sunucuda başlatır.")
    parser.add_argument("--port", type=int, default=8765, help="Yerel HTTP sunucu portu (varsayılan: 8765)")
    args = parser.parse_args()

    if args.test:
        run_tests()
    else:
        serve_web(port=args.port)


if __name__ == "__main__":
    main()

