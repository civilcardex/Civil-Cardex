export const PVC_SCH40 = [
  { dn: 20, dInt: 20.93 }, { dn: 25, dInt: 26.64 }, { dn: 32, dInt: 35.05 },
  { dn: 40, dInt: 40.89 }, { dn: 50, dInt: 52.50 }, { dn: 65, dInt: 62.71 },
  { dn: 80, dInt: 77.93 }, { dn: 100, dInt: 102.26 }, { dn: 150, dInt: 154.05 },
];

export const NEMA_HP = [0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];

export const COMM_HP = [
  { hp: 0.33, kw: 0.25 }, { hp: 0.5, kw: 0.37 },
  { hp: 0.75, kw: 0.55 }, { hp: 1, kw: 0.75 }, { hp: 1.5, kw: 1.1 },
  { hp: 2, kw: 1.5 }, { hp: 3, kw: 2.2 }, { hp: 4, kw: 3 },
  { hp: 5, kw: 3.7 }, { hp: 5.5, kw: 4}, { hp: 7.5, kw: 5.5 }, { hp: 10, kw: 7.5 },{hp:12.5,kw:9.2},
  { hp: 15, kw: 11 }, { hp: 20, kw: 15}, { hp: 25, kw: 18.5 },
  { hp: 30, kw: 22 }, { hp: 40, kw: 30}, { hp: 50, kw: 37},{hp:60,kw:45},
  { hp: 75, kw: 55 }, { hp: 100, kw: 75 },
  { hp: 125, kw: 90 }, { hp: 150, kw: 110 },
];

export function selectDN(Qlps: number, vmax: number) {
  const Qm3s = Qlps / 1000;
  for (const t of PVC_SCH40) {
    const A = (Math.PI * Math.pow(t.dInt / 1000, 2)) / 4;
    const Vreal = Qm3s / A;
    if (Vreal <= vmax * 1.15) return { ...t, Vreal };
  }
  const last = PVC_SCH40[PVC_SCH40.length - 1];
  const A = (Math.PI * Math.pow(last.dInt / 1000, 2)) / 4;
  return { ...last, Vreal: Qm3s / A };
}
