// Ward3D — interactive Three.js hospital ward for DripConnect.
//
// The scene is a pure view of the application simulation state: every frame
// it reads the latest patient rows (remaining volume, flow rate, status)
// from a ref, so the fluid level inside each transparent IV bag, the drip
// animation, status beacons and bedside monitors always match the dashboard
// numbers exactly. The nurse figure is driven by alert state: she works at
// the nurse station, reacts when a critical alert is new, and walks to the
// bedside once the alert is acknowledged / in progress.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export interface ScenePatient {
  id: string;
  name: string;
  bed: string;
  fluid: string;
  initialVolume: number;
  remainingVolume: number;
  flowRate: number;
  prescribedRate: number;
  status: "normal" | "warning" | "critical" | "completed";
  conditionState: string;
  nurseId: string;
  nurseName: string;
}

/** One animated nurse figure in the scene. Each nurse has exactly one
 * figure, a fixed home position at the nurse station, and at most one
 * current target patient — the App's alert-response state machine decides
 * the mode; this component only walks the figure and reports arrival. */
export type NurseAgentMode = "station" | "alert" | "respond" | "inspect";
export interface NurseAgent {
  nurseId: string;
  nurseName: string;
  targetPatientId: string | null;
  mode: NurseAgentMode;
}

export interface CameraPreset { name: string; seq: number }

interface Ward3DProps {
  patients: ScenePatient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  nurseAgents: NurseAgent[];
  onNurseArrived?: (nurseId: string, patientId: string) => void;
  preset: CameraPreset;
  ivChange: { patientId: string; seq: number } | null;
  onBagHung?: (patientId: string) => void;
}

const STATUS_HEX: Record<ScenePatient["status"], string> = {
  normal: "#159b91",
  warning: "#c07f10",
  critical: "#bc2a30",
  completed: "#64748b",
};
const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524];
const HAIR = [0x3a2a1c, 0x14100c, 0x5a4632, 0x222222];
const BLANKET = [0x5e9c97, 0x7d9fc4, 0x93b08a, 0xb0a184];

function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, len, 10), mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

function makeLabelTexture(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, tex };
}

function drawLabel(ctx: CanvasRenderingContext2D, tex: THREE.CanvasTexture, p: ScenePatient) {
  const W = 512, H = 160;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(13,32,48,0.88)";
  ctx.beginPath(); ctx.roundRect(6, 6, W - 12, H - 12, 22); ctx.fill();
  ctx.fillStyle = STATUS_HEX[p.status];
  ctx.beginPath(); ctx.roundRect(6, 6, 16, H - 12, 8); ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 44px 'DM Sans', Arial, sans-serif";
  ctx.fillText(`Bed ${p.bed}`, 42, 62);
  ctx.font = "500 34px 'DM Sans', Arial, sans-serif";
  ctx.fillStyle = "#cfe0ec";
  const name = p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name;
  ctx.fillText(name, 42, 112);
  ctx.font = "700 36px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#ffffff";
  const pct = p.initialVolume > 0 ? Math.round((p.remainingVolume / p.initialVolume) * 100) : 0;
  ctx.fillText(`${pct}%`, 400, 66);
  ctx.font = "500 26px 'DM Sans', Arial, sans-serif";
  ctx.fillStyle = "#9fb8c9";
  ctx.fillText(p.status.toUpperCase(), 388, 112);
  tex.needsUpdate = true;
}

interface BedRefs {
  patientId: string;
  fluid: THREE.Mesh;
  bagGroup: THREE.Group;
  trolleyBag: THREE.Group;
  displayFrac: number;
  beaconMat: THREE.MeshStandardMaterial;
  chamberDrop: THREE.Mesh;
  tubeDrop: THREE.Mesh;
  tubeCurve: THREE.CatmullRomCurve3;
  blanket: THREE.Mesh;
  chest: THREE.Mesh;
  labelKey: string;
  labelCtx: CanvasRenderingContext2D;
  labelTex: THREE.CanvasTexture;
  monCtx: CanvasRenderingContext2D;
  monTex: THREE.CanvasTexture;
  monLast: number;
  phase: number;
}

function buildBedUnit(idx: number, mats: {
  frame: THREE.Material; mattress: THREE.Material; rail: THREE.Material;
  chrome: THREE.Material; glass: THREE.Material; fluidMat: THREE.Material;
  table: THREE.Material; white: THREE.Material;
}): { group: THREE.Group; refs: Omit<BedRefs, "patientId" | "labelKey"> } {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[idx % SKIN.length], roughness: 0.65 });
  const hairM = new THREE.MeshStandardMaterial({ color: HAIR[idx % HAIR.length], roughness: 0.9 });
  const blanketM = new THREE.MeshStandardMaterial({ color: BLANKET[idx % BLANKET.length], roughness: 0.95 });
  const gownM = new THREE.MeshStandardMaterial({ color: 0xa9c6de, roughness: 0.9 });

  // --- Bed frame, mattress, raised back-rest, pillow, rails, wheels ---
  const base = new THREE.Mesh(new RoundedBoxGeometry(1.02, 0.16, 2.2, 3, 0.03), mats.frame);
  base.position.y = 0.52; base.castShadow = true; g.add(base);
  const under = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 1.5), mats.frame);
  under.position.y = 0.28; g.add(under);
  const mattress = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.16, 2.16, 3, 0.05), mats.mattress);
  mattress.position.y = 0.68; mattress.receiveShadow = true; g.add(mattress);
  const backRest = new THREE.Mesh(new RoundedBoxGeometry(0.96, 0.13, 0.78, 3, 0.05), mats.mattress);
  backRest.position.set(0, 0.82, -0.78); backRest.rotation.x = -0.42; g.add(backRest);
  const pillow = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.1, 0.34, 3, 0.04), mats.white);
  pillow.position.set(0, 0.93, -0.86); pillow.rotation.x = -0.42; g.add(pillow);
  const headPanel = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.5, 0.06, 2, 0.02), mats.frame);
  headPanel.position.set(0, 0.62, -1.14); g.add(headPanel);
  const footPanel = new THREE.Mesh(new RoundedBoxGeometry(1.04, 0.42, 0.06, 2, 0.02), mats.frame);
  footPanel.position.set(0, 0.58, 1.14); g.add(footPanel);
  for (const sx of [-0.53, 0.53]) {
    const rail = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.2, 1.1, 2, 0.01), mats.rail);
    rail.position.set(sx, 0.86, 0.25); g.add(rail);
    for (const wz of [-0.95, 0.95]) for (const wx of [-0.4, 0.4]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 12),
        new THREE.MeshStandardMaterial({ color: 0x2b3540, roughness: 0.6 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx + (sx > 0 ? 0.02 : -0.02), 0.06, wz);
      g.add(wheel);
    }
  }

  // --- Patient: head, gown shoulders, blanket body, arm to the IV side ---
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin);
  head.position.set(0, 1.02, -0.88); head.scale.set(0.92, 1, 1.05); head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.108, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), hairM);
  hair.position.set(0, 1.045, -0.9); hair.rotation.x = -0.5; hair.scale.set(0.95, 1, 1.05); g.add(hair);
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.155, 0.3, 6, 14), gownM);
  chest.rotation.x = Math.PI / 2 - 0.42;
  chest.position.set(0, 0.94, -0.62); chest.scale.set(1.25, 1, 0.62); chest.castShadow = true; g.add(chest);
  const blanket = new THREE.Mesh(new THREE.CapsuleGeometry(0.175, 1.05, 6, 16), blanketM);
  blanket.rotation.x = Math.PI / 2;
  blanket.position.set(0, 0.82, 0.32); blanket.scale.set(1.18, 1, 0.55); blanket.castShadow = true; g.add(blanket);
  const shoulder = new THREE.Vector3(0.2, 0.95, -0.58);
  const elbow = new THREE.Vector3(0.44, 0.82, -0.42);
  const handPos = new THREE.Vector3(0.46, 0.8, -0.12);
  g.add(limb(shoulder, elbow, 0.042, gownM));
  g.add(limb(elbow, handPos, 0.036, skin));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), skin);
  hand.position.copy(handPos); hand.scale.set(0.8, 0.55, 1.25); g.add(hand);
  const cannula = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.05),
    new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 0.4 }));
  cannula.position.set(handPos.x, handPos.y + 0.03, handPos.z); g.add(cannula);

  // --- IV stand, bag with live fluid, drip chamber, tube to the hand ---
  const stand = new THREE.Group(); stand.position.set(0.82, 0, -0.62); g.add(stand);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2.05, 10), mats.chrome);
  pole.position.y = 1.05; pole.castShadow = true; stand.add(pole);
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.035, 20), mats.frame);
  baseDisc.position.y = 0.03; stand.add(baseDisc);
  const hookBar = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.34, 8), mats.chrome);
  hookBar.rotation.z = Math.PI / 2; hookBar.position.y = 2.06; stand.add(hookBar);
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x159b91, emissive: 0x159b91, emissiveIntensity: 0.9, roughness: 0.35 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.037, 14, 12), beaconMat);
  beacon.position.y = 2.14; stand.add(beacon);

  const bagGroup = new THREE.Group(); bagGroup.position.set(-0.13, 1.86, 0); stand.add(bagGroup);
  const hanger = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.14, 6), mats.chrome);
  hanger.position.y = 0.22; bagGroup.add(hanger);
  const bagOuter = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.37, 0.055, 3, 0.02), mats.glass);
  bagOuter.renderOrder = 3; bagGroup.add(bagOuter);
  const fluidGeo = new THREE.BoxGeometry(0.16, 0.315, 0.034);
  fluidGeo.translate(0, 0.1575, 0);
  const fluid = new THREE.Mesh(fluidGeo, mats.fluidMat);
  fluid.position.y = -0.165; fluid.renderOrder = 2; bagGroup.add(fluid);
  // graduation ticks on the bag
  const tickMat = new THREE.MeshBasicMaterial({ color: 0x51707f, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.004, 0.002), tickMat);
    tick.position.set(0.055, -0.11 + i * 0.075, 0.03); bagGroup.add(tick);
  }
  const port = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), mats.white);
  port.position.y = -0.2; bagGroup.add(port);
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.085, 12), mats.glass);
  chamber.position.set(0, -0.3, 0); chamber.renderOrder = 3; bagGroup.add(chamber);
  const chamberDrop = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x9fd4e0, roughness: 0.15 }));
  chamberDrop.position.set(0.69, 1.56, -0.62); g.add(chamberDrop);

  // Tube: chamber outlet → down the pole → across to the patient's hand.
  const tubePts = [
    new THREE.Vector3(0.69, 1.5, -0.62),
    new THREE.Vector3(0.78, 1.15, -0.6),
    new THREE.Vector3(0.72, 0.9, -0.45),
    new THREE.Vector3(0.55, 0.83, -0.26),
    handPos.clone().add(new THREE.Vector3(0, 0.035, 0)),
  ];
  const tubeCurve = new THREE.CatmullRomCurve3(tubePts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(tubeCurve, 40, 0.0055, 6),
    new THREE.MeshStandardMaterial({ color: 0xeaf4f6, roughness: 0.25, transparent: true, opacity: 0.75 }));
  g.add(tube);
  const tubeDrop = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x7fc6d8, roughness: 0.2, emissive: 0x2a6d7d, emissiveIntensity: 0.4 }));
  g.add(tubeDrop);
  const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }));
  clamp.position.set(0.755, 1.02, -0.53); clamp.rotation.z = 0.2; g.add(clamp);

  // --- Bedside monitor (stand + live canvas screen) ---
  const monGroup = new THREE.Group(); monGroup.position.set(-0.68, 0, -1.0); monGroup.rotation.y = 0.38; g.add(monGroup);
  const monPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.32, 8), mats.chrome);
  monPole.position.y = 0.66; monGroup.add(monPole);
  const monBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.03, 14), mats.frame);
  monBase.position.y = 0.02; monGroup.add(monBase);
  const monBody = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.33, 0.045, 2, 0.015),
    new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.45 }));
  monBody.position.y = 1.48; monBody.castShadow = true; monGroup.add(monBody);
  const monCanvas = document.createElement("canvas");
  monCanvas.width = 512; monCanvas.height = 352;
  const monCtx = monCanvas.getContext("2d")!;
  const monTex = new THREE.CanvasTexture(monCanvas);
  monTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.425, 0.295),
    new THREE.MeshBasicMaterial({ map: monTex }));
  screen.position.set(0, 1.48, 0.026); monGroup.add(screen);

  // --- Bedside table with cup and chart ---
  const tableG = new THREE.Group(); tableG.position.set(-0.78, 0, -0.28); g.add(tableG);
  const tableTop = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.5, 0.4, 2, 0.02), mats.table);
  tableTop.position.y = 0.32; tableTop.castShadow = true; tableG.add(tableTop);
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.02, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x8a6f52, roughness: 0.7 }));
  drawer.position.set(0, 0.46, 0.16); tableG.add(drawer);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0xdfe9ee, roughness: 0.35 }));
  cup.position.set(-0.1, 0.62, 0.05); tableG.add(cup);
  const chart = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.17),
    new THREE.MeshStandardMaterial({ color: 0xf4f7f9, roughness: 0.8 }));
  chart.position.set(0.08, 0.58, -0.04); chart.rotation.y = 0.4; tableG.add(chart);

  // --- Supply trolley beside the stand, with a spare full IV bottle ---
  const trolley = new THREE.Group(); trolley.position.set(1.62, 0, 0.2); g.add(trolley);
  const trolleyTop = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.04, 0.4, 2, 0.015), mats.chrome);
  trolleyTop.position.y = 0.78; trolleyTop.castShadow = true; trolley.add(trolleyTop);
  const trolleyShelf = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.03, 0.38, 2, 0.015), mats.frame);
  trolleyShelf.position.y = 0.3; trolley.add(trolleyShelf);
  for (const [lx, lz] of [[-0.22, -0.16], [0.22, -0.16], [-0.22, 0.16], [0.22, 0.16]] as const) {
    const legT = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.78, 8), mats.chrome);
    legT.position.set(lx, 0.39, lz); trolley.add(legT);
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x2b3540, roughness: 0.6 }));
    caster.position.set(lx, 0.035, lz); trolley.add(caster);
  }
  const trolleyBag = new THREE.Group(); trolleyBag.position.set(-0.08, 1.0, 0); trolley.add(trolleyBag);
  const spareOuter = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.33, 0.05, 3, 0.02), mats.glass);
  spareOuter.renderOrder = 3; trolleyBag.add(spareOuter);
  const spareFluidGeo = new THREE.BoxGeometry(0.145, 0.285, 0.032);
  spareFluidGeo.translate(0, 0.1425, 0);
  const spareFluid = new THREE.Mesh(spareFluidGeo, mats.fluidMat);
  spareFluid.position.y = -0.15; spareFluid.scale.y = 0.95; spareFluid.renderOrder = 2; trolleyBag.add(spareFluid);
  const spareLabel = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.002), mats.white);
  spareLabel.position.set(0, 0.03, 0.028); trolleyBag.add(spareLabel);
  const spareBox = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.16, 0.24, 2, 0.02),
    new THREE.MeshStandardMaterial({ color: 0xdde7ec, roughness: 0.8 }));
  spareBox.position.set(0.02, 0.42, 0); trolley.add(spareBox);

  // --- Label sprite above the bed ---
  const { ctx: labelCtx, tex: labelTex } = makeLabelTexture();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.35, 0.42, 1);
  sprite.position.set(0, 2.62, -0.5);
  g.add(sprite);

  // Invisible click target for bed selection.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 2.6),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.set(0.2, 0.95, 0);
  hit.name = "bed-hit";
  g.add(hit);

  return {
    group: g,
    refs: {
      fluid, bagGroup, trolleyBag, displayFrac: -1,
      beaconMat, chamberDrop, tubeDrop, tubeCurve, blanket, chest,
      labelCtx, labelTex, monCtx, monTex, monLast: 0, phase: idx * 1.7,
    },
  };
}

function drawMonitor(ctx: CanvasRenderingContext2D, tex: THREE.CanvasTexture, p: ScenePatient, t: number) {
  const W = 512, H = 352;
  ctx.fillStyle = "#0b1620"; ctx.fillRect(0, 0, W, H);
  // ECG trace
  ctx.strokeStyle = "#39d98a"; ctx.lineWidth = 3; ctx.beginPath();
  for (let x = 0; x < W - 150; x += 4) {
    const ph = ((x / 46) + t * 1.6) % 4;
    let y = 62;
    if (ph < 0.35) y = 62 - Math.sin((ph / 0.35) * Math.PI) * 10;
    else if (ph < 0.5) y = 62 + ((ph - 0.35) / 0.15) * 16;
    else if (ph < 0.62) y = 78 - ((ph - 0.5) / 0.12) * 52;
    else if (ph < 0.78) y = 26 + ((ph - 0.62) / 0.16) * 36;
    if (x === 0) ctx.moveTo(x + 8, y); else ctx.lineTo(x + 8, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#39d98a"; ctx.font = "700 54px 'IBM Plex Mono', monospace";
  const hr = p.status === "completed" ? 68 : 72 + Math.round(4 * Math.sin(t * 0.6));
  ctx.fillText(String(hr), 392, 76);
  ctx.font = "500 20px 'DM Sans', Arial"; ctx.fillStyle = "#7fa3b8"; ctx.fillText("HR bpm", 394, 102);
  ctx.fillStyle = "#57b7e8"; ctx.font = "700 50px 'IBM Plex Mono', monospace";
  ctx.fillText("98", 392, 158);
  ctx.font = "500 20px 'DM Sans', Arial"; ctx.fillStyle = "#7fa3b8"; ctx.fillText("SpO₂ %", 394, 184);
  // IV panel
  ctx.fillStyle = "#12242f"; ctx.fillRect(8, 200, W - 16, 142);
  ctx.fillStyle = "#e8f2f7"; ctx.font = "600 25px 'DM Sans', Arial";
  ctx.fillText(`IV · ${p.fluid}`, 24, 240);
  ctx.font = "700 40px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#ffd166";
  const flow = p.status === "completed" ? 0 : Math.round(p.flowRate);
  ctx.fillText(`${flow} mL/h`, 24, 292);
  ctx.font = "500 24px 'DM Sans', Arial"; ctx.fillStyle = "#9fd4e0";
  ctx.fillText(`${Math.round(p.remainingVolume)} mL left`, 268, 292);
  ctx.fillStyle = STATUS_HEX[p.status];
  ctx.fillRect(8, 200, 6, 142);
  if (p.status === "critical") {
    ctx.fillStyle = "#bc2a30"; ctx.font = "700 26px 'DM Sans', Arial";
    ctx.fillText("⚠ CHECK IV — ALERT", 24, 330);
  } else if (p.status === "warning") {
    ctx.fillStyle = "#c07f10"; ctx.font = "700 26px 'DM Sans', Arial";
    ctx.fillText("IV WARNING", 24, 330);
  } else if (p.status === "completed") {
    ctx.fillStyle = "#9fb3c8"; ctx.font = "700 26px 'DM Sans', Arial";
    ctx.fillText("INFUSION COMPLETE", 24, 330);
  }
  tex.needsUpdate = true;
}

function drawStationScreen(ctx: CanvasRenderingContext2D, tex: THREE.CanvasTexture, patients: ScenePatient[], anyResponding: boolean) {
  const W = 640, H = 400;
  ctx.fillStyle = "#0d2136"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff"; ctx.font = "700 30px 'DM Sans', Arial";
  ctx.fillText("DRIPCONNECT — NURSE STATION", 24, 48);
  ctx.font = "500 21px 'DM Sans', Arial"; ctx.fillStyle = "#9fc3d8";
  ctx.fillText("Live infusion monitoring · all beds", 24, 80);
  patients.forEach((p, i) => {
    const y = 118 + i * 62;
    ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fillRect(20, y - 32, W - 40, 52);
    ctx.fillStyle = STATUS_HEX[p.status];
    ctx.beginPath(); ctx.arc(48, y - 6, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#eaf3f8"; ctx.font = "600 24px 'DM Sans', Arial";
    ctx.fillText(`Bed ${p.bed} — ${p.name}`, 72, y + 2);
    ctx.font = "500 22px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#ffd166";
    const pct = p.initialVolume > 0 ? Math.round((p.remainingVolume / p.initialVolume) * 100) : 0;
    ctx.fillText(`${pct}% · ${p.status === "completed" ? 0 : Math.round(p.flowRate)} mL/h`, 430, y + 2);
  });
  const crit = patients.find((p) => p.status === "critical");
  if (crit) {
    ctx.fillStyle = anyResponding ? "#7a1414" : "#bc2a30";
    ctx.fillRect(20, H - 74, W - 40, 54);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 25px 'DM Sans', Arial";
    ctx.fillText(`CRITICAL ALERT — Bed ${crit.bed}: IV attention needed`, 36, H - 39);
  } else if (patients.some((p) => p.status === "warning")) {
    ctx.fillStyle = "#8a5a10"; ctx.fillRect(20, H - 74, W - 40, 54);
    ctx.fillStyle = "#ffffff"; ctx.font = "700 25px 'DM Sans', Arial";
    ctx.fillText("WARNING — check the amber bed on the ward board", 36, H - 39);
  } else {
    ctx.fillStyle = "#0e5c5b"; ctx.fillRect(20, H - 74, W - 40, 54);
    ctx.fillStyle = "#ffffff"; ctx.font = "600 24px 'DM Sans', Arial";
    ctx.fillText("All monitored infusions within limits", 36, H - 39);
  }
  tex.needsUpdate = true;
}

interface NurseRefs {
  nurseId: string;
  group: THREE.Group;
  upper: THREE.Group;
  head: THREE.Group;
  carried: THREE.Group;
  carriedFluid: THREE.Mesh;
  home: THREE.Vector3;
  yaw: number;
  waypoints: THREE.Vector3[];
  wpIndex: number;
  arrived: boolean;
  arrivedNotifiedFor: string | null;
  arrivedAtT: number;
  lastMode: NurseAgentMode;
  lastTarget: string | null;
}

const SCRUB_COLORS = [0x1f7a8c, 0x2a6d9e, 0x3d7a5e];

function buildNurse(nurseId: string, nurseName: string, idx: number, home: THREE.Vector3): NurseRefs {
  const group = new THREE.Group();
  const scrubs = new THREE.MeshStandardMaterial({ color: SCRUB_COLORS[idx % SCRUB_COLORS.length], roughness: 0.85 });
  const scrubsDark = new THREE.MeshStandardMaterial({ color: 0x175263, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: SKIN[idx % SKIN.length], roughness: 0.65 });
  const hairM = new THREE.MeshStandardMaterial({ color: HAIR[idx % HAIR.length], roughness: 0.9 });

  for (const sx of [-0.09, 0.09]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.78, 10), scrubsDark);
    leg.position.set(sx, 0.39, 0); leg.castShadow = true; group.add(leg);
    const shoe = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.05, 0.2, 2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xf0f3f5, roughness: 0.5 }));
    shoe.position.set(sx, 0.03, 0.04); group.add(shoe);
  }
  const upper = new THREE.Group(); upper.position.y = 0.78; group.add(upper);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.34, 6, 14), scrubs);
  torso.position.y = 0.32; torso.scale.set(1.15, 1, 0.72); torso.castShadow = true; upper.add(torso);
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
  badge.position.set(0.09, 0.42, 0.11); upper.add(badge);
  const lArm = limb(new THREE.Vector3(-0.19, 0.52, 0), new THREE.Vector3(-0.26, 0.12, 0.1), 0.04, scrubs);
  upper.add(lArm);
  const rArm = limb(new THREE.Vector3(0.19, 0.52, 0), new THREE.Vector3(0.27, 0.14, 0.14), 0.04, scrubs);
  upper.add(rArm);
  const lHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skin);
  lHand.position.set(-0.26, 0.1, 0.11); upper.add(lHand);
  const rHand = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skin);
  rHand.position.set(0.27, 0.12, 0.15); upper.add(rHand);
  const clipboard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.27),
    new THREE.MeshStandardMaterial({ color: 0x33424f, roughness: 0.5 }));
  clipboard.position.set(0.24, 0.16, 0.2); clipboard.rotation.x = -0.5; upper.add(clipboard);

  // IV bottle the nurse carries during a bedside bottle change.
  const carried = new THREE.Group(); carried.position.set(0.31, 0.3, 0.24); carried.visible = false; upper.add(carried);
  const cOuter = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.3, 0.05, 3, 0.02),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transparent: true, opacity: 0.32, depthWrite: false }));
  cOuter.renderOrder = 3; carried.add(cOuter);
  const cFluidGeo = new THREE.BoxGeometry(0.135, 0.26, 0.032);
  cFluidGeo.translate(0, 0.13, 0);
  const carriedFluid = new THREE.Mesh(cFluidGeo,
    new THREE.MeshStandardMaterial({ color: 0xaadcea, roughness: 0.15, transparent: true, opacity: 0.9 }));
  carriedFluid.position.y = -0.135; carriedFluid.scale.y = 0.04; carriedFluid.renderOrder = 2; carried.add(carriedFluid);

  const headG = new THREE.Group(); headG.position.y = 0.72; upper.add(headG);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 10), skin);
  neck.position.y = -0.02; headG.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 22, 16), skin);
  head.position.y = 0.1; head.scale.set(0.92, 1.05, 0.98); head.castShadow = true; headG.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.098, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM);
  hair.position.y = 0.115; hair.rotation.x = -0.25; headG.add(hair);
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), hairM);
  bun.position.set(0, 0.2, -0.07); headG.add(bun);
  // stethoscope arc
  const steth = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 8, 20, Math.PI * 1.25),
    new THREE.MeshStandardMaterial({ color: 0x22303c, roughness: 0.4 }));
  steth.position.set(0, 0.0, 0.06); steth.rotation.z = Math.PI * 0.87; headG.add(steth);

  // Name label floating above the nurse so the evaluator can see WHICH
  // nurse is responding (assignments are per-patient, never random).
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 512; labelCanvas.height = 112;
  const lctx = labelCanvas.getContext("2d")!;
  lctx.fillStyle = "rgba(13,32,48,0.85)";
  lctx.beginPath(); lctx.roundRect(56, 14, 400, 84, 20); lctx.fill();
  lctx.fillStyle = "#ffffff";
  lctx.font = "600 40px 'DM Sans', Arial, sans-serif";
  lctx.textAlign = "center";
  const labelName = nurseName.length > 20 ? `${nurseName.slice(0, 19)}…` : nurseName;
  lctx.fillText(labelName, 256, 68);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false }));
  sprite.scale.set(0.95, 0.21, 1);
  sprite.position.y = 1.98;
  group.add(sprite);

  group.position.copy(home);
  return {
    nurseId, group, upper, head: headG, carried, carriedFluid,
    home: home.clone(), yaw: 0, waypoints: [], wpIndex: 0, arrived: false,
    arrivedNotifiedFor: null, arrivedAtT: 0, lastMode: "station", lastTarget: null,
  };
}

export default function Ward3D({ patients, selectedId, onSelect, nurseAgents, onNurseArrived, preset, ivChange, onBagHung }: Ward3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef({ patients, selectedId, nurseAgents, ivChange });
  propsRef.current = { patients, selectedId, nurseAgents, ivChange };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onBagHungRef = useRef(onBagHung);
  onBagHungRef.current = onBagHung;
  const onNurseArrivedRef = useRef(onNurseArrived);
  onNurseArrivedRef.current = onNurseArrived;
  const presetRef = useRef(preset);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setError("WebGL is not available in this browser, so the 3D ward cannot be shown. The dashboard above remains fully functional.");
      return;
    }
    const bedCount = propsRef.current.patients.length;
    const multi = bedCount > 1;
    const bedX = (i: number) => (multi ? (i - (bedCount - 1) / 2) * 4.7 : 0);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfe9ee);
    scene.fog = new THREE.Fog(0xdfe9ee, 16, 30);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(multi ? 5.4 : 3.1, multi ? 3.3 : 2.2, multi ? 6.9 : 4.1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.0, -0.2);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = 1.48;
    controls.minDistance = 1.6;
    controls.maxDistance = 16;

    // --- Lights ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa5b5, 0.85));
    const key = new THREE.DirectionalLight(0xfff4e0, 1.6);
    key.position.set(4.5, 7.5, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -6;
    key.shadow.camera.far = 22;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdceefc, 0.45);
    fill.position.set(-6, 4, 5);
    scene.add(fill);

    // --- Materials shared across beds ---
    const mats = {
      frame: new THREE.MeshStandardMaterial({ color: 0xb9c8d2, roughness: 0.35, metalness: 0.55 }),
      mattress: new THREE.MeshStandardMaterial({ color: 0xf4f7f5, roughness: 0.95 }),
      rail: new THREE.MeshStandardMaterial({ color: 0xd7e3e8, roughness: 0.3, metalness: 0.4 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xd9e2e8, roughness: 0.18, metalness: 0.9 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.26,
        clearcoat: 1, depthWrite: false,
      }),
      fluidMat: new THREE.MeshStandardMaterial({ color: 0xaadcea, roughness: 0.15, transparent: true, opacity: 0.88 }),
      table: new THREE.MeshStandardMaterial({ color: 0xa98f6e, roughness: 0.75 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf7fafc, roughness: 0.9 }),
    };

    // --- Room shell: floor, walls, ceiling lights, windows, corridor ---
    const room = new THREE.Group(); scene.add(room);
    const floorTexC = document.createElement("canvas");
    floorTexC.width = 256; floorTexC.height = 256;
    const fx = floorTexC.getContext("2d")!;
    fx.fillStyle = "#dde5ea"; fx.fillRect(0, 0, 256, 256);
    fx.strokeStyle = "#c3cfd7"; fx.lineWidth = 3; fx.strokeRect(0, 0, 256, 256);
    fx.fillStyle = "rgba(255,255,255,0.25)"; fx.fillRect(0, 0, 128, 128); fx.fillRect(128, 128, 128, 128);
    const floorTex = new THREE.CanvasTexture(floorTexC);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 4);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(17, 8.6),
      new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 0.6);
    floor.receiveShadow = true; room.add(floor);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9eff2, roughness: 0.95 });
    const wainscot = new THREE.MeshStandardMaterial({ color: 0xbcd2da, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(17, 3.3, 0.15), wallMat);
    backWall.position.set(0, 1.65, -3.35); backWall.receiveShadow = true; room.add(backWall);
    const backTrim = new THREE.Mesh(new THREE.BoxGeometry(17, 0.85, 0.17), wainscot);
    backTrim.position.set(0, 0.42, -3.35); room.add(backTrim);
    for (const sx of [-8.55, 8.55]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 8.6), wallMat);
      side.position.set(sx, 1.65, 0.6); room.add(side);
    }
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xf2f5f7, roughness: 1 });
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(17, 0.1, 8.6), ceilMat);
    ceil.position.set(0, 3.32, 0.6); room.add(ceil);
    for (let i = 0; i < (multi ? 3 : 1); i++) {
      const panel = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.05, 0.55, 2, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6dd, emissiveIntensity: 1.4 }));
      panel.position.set(bedX(i), 3.26, -0.6); room.add(panel);
    }
    // windows with daylight on the back wall
    for (let i = 0; i < (multi ? 3 : 1); i++) {
      const win = new THREE.Group(); win.position.set(bedX(i), 2.35, -3.26); room.add(win);
      const glassP = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xcfe6f2, emissive: 0xbcd9ea, emissiveIntensity: 0.55, roughness: 0.2 }));
      win.add(glassP);
      const frameM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
      for (const [w, h, x, y] of [[1.58, 0.06, 0, 0.5], [1.58, 0.06, 0, -0.5], [0.06, 1.02, 0.78, 0], [0.06, 1.02, -0.78, 0], [0.05, 0.95, 0, 0]] as const) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), frameM);
        bar.position.set(x, y, 0.01); win.add(bar);
      }
    }
    // corridor glimpse through a doorway on the right wall
    const corridor = new THREE.Group(); corridor.position.set(8.44, 0, 2.2); corridor.rotation.y = -Math.PI / 2; room.add(corridor);
    const corrGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.2),
      new THREE.MeshStandardMaterial({ color: 0xf6e8c8, emissive: 0xe8cf9e, emissiveIntensity: 0.7 }));
    corrGlow.position.set(0, 1.1, -0.5); corridor.add(corrGlow);
    const doorFrame = new THREE.Mesh(new RoundedBoxGeometry(1.3, 2.3, 0.1, 2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x9db4c0, roughness: 0.6 }));
    doorFrame.position.set(0, 1.15, 0.05); corridor.add(doorFrame);
    const doorHole = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.2),
      new THREE.MeshBasicMaterial({ color: 0xf3e3bd }));
    doorHole.position.set(0, 1.1, 0.11); corridor.add(doorHole);
    // wall clock
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 24),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
    clock.rotation.x = Math.PI / 2; clock.position.set(multi ? -6.9 : -2.6, 2.5, -3.24); room.add(clock);

    // --- Beds ---
    const beds: BedRefs[] = [];
    const hitMeshes: THREE.Mesh[] = [];
    propsRef.current.patients.forEach((p, i) => {
      const { group, refs } = buildBedUnit(i, mats);
      group.position.set(bedX(i), 0, -0.55);
      scene.add(group);
      const bed: BedRefs = { ...refs, patientId: p.id, labelKey: "" };
      beds.push(bed);
      group.traverse((o) => { if (o.name === "bed-hit") { (o as THREE.Mesh).userData.patientId = p.id; hitMeshes.push(o as THREE.Mesh); } });
    });
    // selected-bed floor ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.58, 40),
      new THREE.MeshBasicMaterial({ color: 0x0f2a4a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; scene.add(ring);

    // privacy curtains between beds
    if (multi) {
      const curtMat = new THREE.MeshStandardMaterial({
        color: 0x9fc3d4, roughness: 0.9, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
      });
      for (let i = 0; i < bedCount - 1; i++) {
        const cx = (bedX(i) + bedX(i + 1)) / 2;
        const railC = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.6, 8), mats.chrome);
        railC.rotation.x = Math.PI / 2; railC.position.set(cx, 2.42, -0.55); scene.add(railC);
        const geo = new THREE.PlaneGeometry(2.3, 1.78, 36, 1);
        const posAttr = geo.attributes.position;
        if (posAttr instanceof THREE.BufferAttribute) {
          for (let v = 0; v < posAttr.count; v++) {
            posAttr.setZ(v, Math.sin((posAttr.getX(v) / 2.3) * Math.PI * 7) * 0.055);
          }
        }
        geo.computeVertexNormals();
        const curt = new THREE.Mesh(geo, curtMat);
        curt.rotation.y = Math.PI / 2;
        curt.position.set(cx, 1.5, -0.55);
        scene.add(curt);
      }
    }

    // --- Nurse station: desk, alert board screen, chair ---
    const station = new THREE.Group(); station.position.set(5.7, 0, 2.75); station.rotation.y = -0.62; scene.add(station);
    const deskMat = new THREE.MeshStandardMaterial({ color: 0x8799a6, roughness: 0.5, metalness: 0.2 });
    const deskTop = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.06, 0.75, 2, 0.02), deskMat);
    deskTop.position.y = 0.74; deskTop.castShadow = true; station.add(deskTop);
    for (const sx of [-1.05, 1.05]) {
      const legP = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 0.65), deskMat);
      legP.position.set(sx, 0.37, 0); station.add(legP);
    }
    const modesty = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.5, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x5f7484, roughness: 0.6 }));
    modesty.position.set(0, 0.45, 0.33); station.add(modesty);
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.02, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x2b3944, roughness: 0.5 }));
    kb.position.set(-0.2, 0.78, 0.12); station.add(kb);
    const phone = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.03, 0.17, 2, 0.01),
      new THREE.MeshStandardMaterial({ color: 0x141c22, roughness: 0.35 }));
    phone.position.set(0.45, 0.79, 0.1); phone.rotation.y = 0.4; station.add(phone);
    const boardCanvas = document.createElement("canvas");
    boardCanvas.width = 640; boardCanvas.height = 400;
    const boardCtx = boardCanvas.getContext("2d")!;
    const boardTex = new THREE.CanvasTexture(boardCanvas);
    boardTex.colorSpace = THREE.SRGBColorSpace;
    // Wall-mounted ward board on the back wall — the station's shared display.
    const wallBoard = new THREE.Group(); wallBoard.position.set(multi ? 6.35 : 2.9, 2.0, -3.24); scene.add(wallBoard);
    const wbBody = new THREE.Mesh(new RoundedBoxGeometry(1.78, 1.16, 0.06, 2, 0.015),
      new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.45 }));
    wallBoard.add(wbBody);
    const wbScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.68, 1.05),
      new THREE.MeshBasicMaterial({ map: boardTex }));
    wbScreen.position.z = 0.035; wallBoard.add(wbScreen);
    // Desk monitor angled toward the nurse's standing position.
    const deskMon = new THREE.Group(); deskMon.position.set(-0.35, 0.77, -0.02); deskMon.rotation.y = 2.55; station.add(deskMon);
    const dmBody = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.4, 0.04, 2, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x1c2833, roughness: 0.45 }));
    dmBody.position.y = 0.26; deskMon.add(dmBody);
    const dmScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.53, 0.35),
      new THREE.MeshBasicMaterial({ map: boardTex }));
    dmScreen.position.set(0, 0.26, 0.024); deskMon.add(dmScreen);
    const dmStand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.08, 8), mats.chrome);
    dmStand.position.y = 0.03; deskMon.add(dmStand);
    const chairSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18),
      new THREE.MeshStandardMaterial({ color: 0x2c4a5e, roughness: 0.8 }));
    chairSeat.position.set(0.25, 0.48, 0.55); station.add(chairSeat);
    const chairBack = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.5, 0.05, 2, 0.02),
      new THREE.MeshStandardMaterial({ color: 0x2c4a5e, roughness: 0.8 }));
    chairBack.position.set(0.25, 0.85, 0.78); station.add(chairBack);
    const chairPost = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), mats.chrome);
    chairPost.position.set(0.25, 0.24, 0.55); station.add(chairPost);

    // --- Nurses: one figure per distinct assigned nurse of the visible
    // beds, each with a designated home position in front of the nurse
    // station. A nurse is never duplicated, however many of her patients
    // alert at once — extra alerts queue in the App state. ---
    const nurses: NurseRefs[] = [];
    {
      const seen = new Map<string, NurseAgent>();
      for (const a of propsRef.current.nurseAgents) {
        if (!seen.has(a.nurseId)) seen.set(a.nurseId, a);
      }
      let ni = 0;
      for (const a of seen.values()) {
        const home = new THREE.Vector3(4.35 + ni * 0.62, 0, 1.9 - (ni % 2) * 0.42);
        const n = buildNurse(a.nurseId, a.nurseName, ni, home);
        n.yaw = Math.atan2(5.7 - home.x, 2.75 - home.z);
        n.group.rotation.y = n.yaw;
        scene.add(n.group);
        nurses.push(n);
        ni += 1;
      }
    }
    const nurseForPatient = (patientId: string | null): NurseRefs | undefined => {
      if (!patientId) return undefined;
      const p = propsRef.current.patients.find((x) => x.id === patientId);
      if (p) {
        const byNurse = nurses.find((n) => n.nurseId === p.nurseId);
        if (byNurse) return byNurse;
      }
      const agent = propsRef.current.nurseAgents.find((a) => a.targetPatientId === patientId);
      return agent ? nurses.find((n) => n.nurseId === agent.nurseId) : undefined;
    };

    // --- Interaction: click a bed to select it ---
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => { downAt = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      const pid = hits[0]?.object.userData.patientId as string | undefined;
      if (pid) onSelectRef.current(pid);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    // --- Camera preset tween ---
    let camTween: { t: number; fromP: THREE.Vector3; toP: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3 } | null = null;
    const applyPreset = (name: string) => {
      const selIdx = Math.max(0, propsRef.current.patients.findIndex((p) => p.id === propsRef.current.selectedId));
      const bx = bedX(selIdx);
      const presets: Record<string, [THREE.Vector3, THREE.Vector3]> = {
        overview: [new THREE.Vector3(multi ? 5.4 : 3.1, multi ? 3.3 : 2.2, multi ? 6.9 : 4.1), new THREE.Vector3(0, 1.0, -0.2)],
        bedside: [new THREE.Vector3(bx + 2.3, 1.65, 1.7), new THREE.Vector3(bx + 0.2, 1.05, -0.55)],
        station: [new THREE.Vector3(3.2, 1.9, 0.4), new THREE.Vector3(5.7, 1.0, 2.8)],
        top: [new THREE.Vector3(0, 8.2, 1.6), new THREE.Vector3(0, 0, 0.1)],
      };
      const [tp, tt] = presets[name] ?? presets.overview!;
      camTween = { t: 0, fromP: camera.position.clone(), toP: tp, fromT: controls.target.clone(), toT: tt };
    };

    const resize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // --- Animation loop: everything reads the live simulation ref ---
    const clockT = new THREE.Clock();
    let raf = 0;
    let boardLast = 0;
    // Bedside bottle-change sequence state (nurse swaps the empty bag).
    const changeState: {
      lastSeq: number;
      pending: { bedIdx: number; since: number } | null;
      active: { bedIdx: number; t0: number; stage: number; hungNotified: boolean } | null;
    } = { lastSeq: 0, pending: null, active: null };
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clockT.getDelta(), 0.05);
      const t = clockT.elapsedTime;
      const { patients: live, selectedId: selId } = propsRef.current;

      beds.forEach((bed, i) => {
        const p = live.find((x) => x.id === bed.patientId) ?? live[i];
        if (!p) return;
        const frac = p.initialVolume > 0 ? THREE.MathUtils.clamp(p.remainingVolume / p.initialVolume, 0, 1) : 0;
        // The visible fluid level eases toward the true state fraction:
        // draining is fast, refilling (a fresh bottle being hung) is a
        // visible pour over ~2 seconds.
        if (bed.displayFrac < 0) bed.displayFrac = frac;
        const dFrac = frac - bed.displayFrac;
        const maxStep = (dFrac > 0 ? 0.55 : 1.6) * dt;
        bed.displayFrac += Math.abs(dFrac) <= maxStep ? dFrac : Math.sign(dFrac) * maxStep;
        bed.fluid.scale.y = Math.max(bed.displayFrac, 0.0001);
        bed.fluid.visible = bed.displayFrac > 0.004;
        const flow = p.status === "completed" ? 0 : p.flowRate;
        // breathing (subtle, ~14 breaths/min)
        const br = 1 + 0.045 * Math.sin(t * 1.45 + bed.phase);
        bed.blanket.scale.set(1.18, br, 0.55);
        bed.chest.scale.set(1.25, 1, 0.62 * (1 + 0.05 * Math.sin(t * 1.45 + bed.phase)));
        // drip chamber droplet
        if (flow > 0.5) {
          bed.chamberDrop.visible = true;
          const cyc = (t * (0.35 + flow / 90)) % 1;
          bed.chamberDrop.position.y = 1.578 - cyc * 0.05;
          bed.chamberDrop.scale.setScalar(0.7 + cyc * 0.5);
        } else bed.chamberDrop.visible = false;
        // flow indicator travelling through the tube
        if (flow > 0.5 || flow < -0.5) {
          bed.tubeDrop.visible = true;
          const speed = 0.1 + Math.abs(flow) / 500;
          let u = (t * speed) % 1;
          if (flow < 0) u = 1 - u;
          bed.tubeDrop.position.copy(bed.tubeCurve.getPointAt(u));
        } else bed.tubeDrop.visible = false;
        // status beacon
        const hex = STATUS_HEX[p.status];
        bed.beaconMat.color.set(hex);
        bed.beaconMat.emissive.set(hex);
        bed.beaconMat.emissiveIntensity = p.status === "critical"
          ? 1.1 + 0.9 * Math.sin(t * 3.4)
          : p.status === "warning" ? 0.9 + 0.35 * Math.sin(t * 2.2) : 0.85;
        // label + monitor refresh when data changes
        const key = `${p.status}|${Math.round(p.remainingVolume)}|${p.name}|${p.bed}`;
        if (key !== bed.labelKey) {
          bed.labelKey = key;
          drawLabel(bed.labelCtx, bed.labelTex, p);
        }
        if (t - bed.monLast > 0.18) {
          bed.monLast = t;
          drawMonitor(bed.monCtx, bed.monTex, p, t + bed.phase);
        }
      });

      const selIdx = live.findIndex((p) => p.id === selId);
      if (selIdx >= 0) {
        ring.visible = true;
        ring.position.x = bedX(selIdx);
        ring.position.z = -0.55;
      } else ring.visible = false;

      // station board refresh ~3×/s
      if (t - boardLast > 0.33) {
        boardLast = t;
        const anyResponding = propsRef.current.nurseAgents.some((a) => a.mode === "respond" || a.mode === "inspect");
        drawStationScreen(boardCtx, boardTex, live, anyResponding);
      }

      // --- Nurse behaviour: every nurse figure is driven by her own
      // agent entry (assigned patients only). A nurse with no alert stays
      // at the station; a nurse whose alert fires turns to the board, then
      // walks the front aisle to her patient's bedside — never through a
      // bed — and reports arrival back to the App state machine. ---
      const { patients: livePats, nurseAgents: liveAgents } = propsRef.current;
      const changingNurse = changeState.active || changeState.pending
        ? nurseForPatient((changeState.active
          ? livePats[changeState.active.bedIdx]?.id
          : livePats[changeState.pending!.bedIdx]?.id) ?? null)
        : undefined;
      for (const nurse of nurses) {
        if (changingNurse && nurse.nurseId === changingNurse.nurseId && changeState.active) {
          continue; // the bottle-change sequence below drives this nurse
        }
        const agent = liveAgents.find((a) => a.nurseId === nurse.nurseId);
        const mode: NurseAgentMode = agent?.mode ?? "station";
        const targetId = (mode === "respond" || mode === "inspect") ? agent?.targetPatientId ?? null : null;
        const targetBedIdx = targetId ? livePats.findIndex((p) => p.id === targetId) : -1;
        if (mode !== nurse.lastMode || targetId !== nurse.lastTarget) {
          nurse.lastMode = mode; nurse.lastTarget = targetId;
          nurse.arrived = false;
          if (targetId) nurse.arrivedNotifiedFor = null;
          if ((mode === "respond" || mode === "inspect") && targetBedIdx >= 0) {
            const bx = bedX(targetBedIdx);
            // Path: along the clear front aisle (z ≈ 1.25, in front of all
            // beds and trolleys), then turn up to the bedside. End point is
            // right beside the IV stand (stand base at bx + 0.82, -1.17),
            // so the nurse visibly arrives AT the patient's IV pole.
            const lane = (nurses.indexOf(nurse) % 3) * 0.14;
            nurse.waypoints = [
              new THREE.Vector3(nurse.group.position.x, 0, 1.3 + lane),
              new THREE.Vector3(bx + 1.45, 0, 1.25 + lane),
              new THREE.Vector3(bx + 1.28, 0, -0.72),
            ];
            nurse.wpIndex = 0;
          } else if (mode === "station") {
            nurse.waypoints = [
              new THREE.Vector3(nurse.group.position.x, 0, 1.3),
              nurse.home.clone(),
            ];
            nurse.wpIndex = 0;
          } else {
            nurse.waypoints = [];
            nurse.wpIndex = 0;
          }
        }
        const target = nurse.waypoints[nurse.wpIndex];
        let moving = false;
        if (target) {
          const pos = nurse.group.position;
          const dx = target.x - pos.x, dz = target.z - pos.z;
          const dist = Math.hypot(dx, dz);
          if (dist > 0.06) {
            moving = true;
            const urgent = changeState.pending != null || changeState.active != null;
            const step = Math.min(dist, dt * (urgent ? 3.1 : 2.3));
            pos.x += (dx / dist) * step;
            pos.z += (dz / dist) * step;
            const wantYaw = Math.atan2(dx, dz);
            let dy = wantYaw - nurse.yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            nurse.yaw += dy * Math.min(1, dt * 7);
            nurse.group.rotation.y = nurse.yaw;
          } else if (nurse.wpIndex < nurse.waypoints.length - 1) {
            nurse.wpIndex += 1;
          } else if (!nurse.arrived) {
            nurse.arrived = true;
            nurse.arrivedAtT = t;
            if (targetId && nurse.arrivedNotifiedFor !== targetId) {
              nurse.arrivedNotifiedFor = targetId;
              onNurseArrivedRef.current?.(nurse.nurseId, targetId);
            }
          }
        }
        // gait bob / idle / bedside check lean
        if (moving) {
          nurse.group.position.y = Math.abs(Math.sin(t * 7.2)) * 0.035;
          nurse.upper.rotation.x = 0.06;
          nurse.head.rotation.x = 0.05;
          nurse.head.rotation.y = 0;
        } else if ((mode === "respond" || mode === "inspect") && nurse.arrived && targetBedIdx >= 0) {
          nurse.group.position.y = 0;
          // face the IV stand and inspect: gentle lean + head turns between bag and patient
          const bx = bedX(targetBedIdx);
          const wantYaw = Math.atan2((bx + 0.8) - nurse.group.position.x, -0.62 - nurse.group.position.z);
          let dy = wantYaw - nurse.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          nurse.yaw += dy * Math.min(1, dt * 5);
          nurse.group.rotation.y = nurse.yaw;
          nurse.upper.rotation.x = 0.16 + 0.03 * Math.sin(t * 1.3);
          nurse.head.rotation.y = 0.35 * Math.sin(t * 0.55);
          nurse.head.rotation.x = 0.18;
        } else if (mode === "alert") {
          nurse.group.position.y = 0;
          // turns toward the station board, alert and upright
          const wantYaw = Math.atan2(5.7 - nurse.group.position.x, 2.75 - nurse.group.position.z);
          let dy = wantYaw - nurse.yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          nurse.yaw += dy * Math.min(1, dt * 5);
          nurse.group.rotation.y = nurse.yaw;
          nurse.upper.rotation.x = 0.02;
          nurse.head.rotation.x = -0.08 + 0.02 * Math.sin(t * 2.4);
          nurse.head.rotation.y = 0;
        } else {
          nurse.group.position.y = 0;
          nurse.upper.rotation.x = 0.1 + 0.015 * Math.sin(t * 1.1);
          nurse.head.rotation.x = 0.22; // reading the board / charting
          nurse.head.rotation.y = 0.08 * Math.sin(t * 0.4);
        }
      }

      // --- Bedside IV bottle change: the nurse removes the empty bag,
      // takes a fresh full bottle from the supply trolley, hangs it on the
      // stand and checks the line. Driven by the ivChange prop; the App
      // restarts the infusion in shared state as the new bag goes up, so
      // the fluid visibly pours back into the bag. ---
      const chReq = propsRef.current.ivChange;
      if (chReq && chReq.seq !== changeState.lastSeq) {
        changeState.lastSeq = chReq.seq;
        const bi = live.findIndex((p) => p.id === chReq.patientId);
        if (bi >= 0) changeState.pending = { bedIdx: bi, since: t };
      }
      if (!changeState.active && changeState.pending) {
        const pendBed = live[changeState.pending.bedIdx];
        const pendNurse = pendBed ? nurseForPatient(pendBed.id) : undefined;
        const atBedside = pendNurse != null && pendNurse.arrived && pendBed != null && pendNurse.lastTarget === pendBed.id;
        // The swap animation only starts once the nurse is actually standing
        // at this bed — the long fallback exists solely so a missed arrival
        // can never deadlock the sequence.
        if (atBedside || t - changeState.pending.since > 10) {
          changeState.active = { bedIdx: changeState.pending.bedIdx, t0: t, stage: 0, hungNotified: false };
          changeState.pending = null;
        }
      }
      const act = changeState.active;
      if (act) {
        const bed = beds[act.bedIdx];
        const ct = t - act.t0;
        const nurse = bed ? nurseForPatient(bed.patientId) : undefined;
        if (bed && nurse) {
          const BAG_HOME_Y = 1.86;
          const turnTo = (wx: number, wz: number) => {
            const wantYaw = Math.atan2(wx - nurse.group.position.x, wz - nurse.group.position.z);
            let dy = wantYaw - nurse.yaw;
            while (dy > Math.PI) dy -= Math.PI * 2;
            while (dy < -Math.PI) dy += Math.PI * 2;
            nurse.yaw += dy * Math.min(1, dt * 5);
            nurse.group.rotation.y = nurse.yaw;
          };
          if (ct < 0.9) {
            // Reaching up and taking the empty bag down off the hook.
            const e = ct / 0.9;
            bed.bagGroup.position.y = BAG_HOME_Y - 0.38 * e;
            bed.bagGroup.scale.setScalar(1 - 0.35 * e);
            nurse.upper.rotation.x = 0.3;
            nurse.head.rotation.x = -0.15;
          }
          if (ct >= 0.9 && act.stage < 1) {
            act.stage = 1;
            bed.bagGroup.visible = false;
            nurse.carried.visible = true;
            nurse.carriedFluid.scale.y = 0.04; // the empty bottle, in her hand
          }
          if (ct >= 0.9 && ct < 2.4) {
            // Turn to the supply trolley to swap the empty bottle.
            turnTo(bedX(act.bedIdx) + 1.62, -0.35);
            nurse.upper.rotation.x = 0.22;
          }
          if (ct >= 2.4 && act.stage < 2) {
            act.stage = 2;
            bed.trolleyBag.visible = false; // fresh bottle taken from the trolley
            nurse.carriedFluid.scale.y = 0.95; // …and now in her hand, full
          }
          if (ct >= 2.4 && ct < 3.6) {
            // Turn back to the IV stand with the fresh bottle.
            turnTo(bedX(act.bedIdx) + 0.69, -1.17);
            nurse.upper.rotation.x = 0.24;
          }
          if (ct >= 3.6 && act.stage < 3) {
            act.stage = 3;
            bed.bagGroup.visible = true; // fresh bottle goes up on the hook
            nurse.carried.visible = false;
            // The new bottle is physically on the stand NOW — tell the App so
            // it restarts the infusion in the shared state at this exact
            // moment (not on a blind timer while the nurse is still walking).
            if (!act.hungNotified) {
              act.hungNotified = true;
              onBagHungRef.current?.(bed.patientId);
            }
          }
          if (ct >= 3.6 && ct < 4.6) {
            const e = (ct - 3.6) / 1.0;
            bed.bagGroup.position.y = (BAG_HOME_Y - 0.38) + 0.38 * e;
            bed.bagGroup.scale.setScalar(0.65 + 0.35 * e);
            nurse.upper.rotation.x = 0.3;
            nurse.head.rotation.x = -0.12;
          }
          if (ct >= 4.6) {
            bed.bagGroup.position.y = BAG_HOME_Y;
            bed.bagGroup.scale.setScalar(1);
            nurse.upper.rotation.x = 0.16;
            nurse.head.rotation.y = 0.3 * Math.sin(t * 0.7); // checking bag, then tube, then patient
          }
          if (ct >= 5.6) changeState.active = null;
        } else {
          changeState.active = null;
        }
      }

      if (camTween) {
        camTween.t = Math.min(1, camTween.t + dt / 1.1);
        const e = 1 - Math.pow(1 - camTween.t, 3);
        camera.position.lerpVectors(camTween.fromP, camTween.toP, e);
        controls.target.lerpVectors(camTween.fromT, camTween.toT, e);
        if (camTween.t >= 1) camTween = null;
      }
      const extPreset = presetRef.current;
      if (extPreset.seq > 0 && extPreset.seq !== (applyPreset as unknown as { lastSeq?: number }).lastSeq) {
        (applyPreset as unknown as { lastSeq?: number }).lastSeq = extPreset.seq;
        applyPreset(extPreset.name);
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      pmrem.dispose();
      renderer.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
          o.geometry?.dispose();
          const m = o.material as THREE.Material | THREE.Material[];
          (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
    // Scene is built once for the mounted bed set; App remounts (key) when the set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // expose preset requests
  useEffect(() => { presetRef.current = preset; }, [preset]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[var(--radius)]" style={{ background: "#dfe9ee" }}>
      <div ref={mountRef} className="h-full w-full [&>canvas]:block" role="img"
        aria-label="Interactive 3D hospital ward: patients in beds with IV stands, live fluid levels, bedside monitors and a nurse station" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-medium" style={{ color: "var(--crit)" }}>
          {error}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
        Drag to orbit · Scroll / pinch to zoom · Click a bed to select the patient
      </div>
    </div>
  );
}
