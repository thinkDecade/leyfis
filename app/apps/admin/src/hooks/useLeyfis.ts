import { shortAddr, VAULT_PROGRAM_ID } from "@leyfis/shared";
export type AuditEntry = {
  wallet:string; vault:string; timestamp:number; slot:number;
  outcome:"approved"|"denied"; reasonCode:number; attestationId:string; tier:number; signature?:string;
};
export const MOCK_AUDIT: AuditEntry[] = [
  {wallet:"5t1okyeK...s9fjS",vault:shortAddr(VAULT_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000)-120,slot:450558700,outcome:"denied",reasonCode:1,attestationId:"111...111",tier:0},
  {wallet:"64je9Dfo...kxfb",vault:shortAddr(VAULT_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000)-60,slot:450558750,outcome:"approved",reasonCode:0,attestationId:"Ax7mPq...3kLw",tier:3},
  {wallet:"5t1okyeK...s9fjS",vault:shortAddr(VAULT_PROGRAM_ID),timestamp:Math.floor(Date.now()/1000)-30,slot:450558800,outcome:"denied",reasonCode:1,attestationId:"111...111",tier:0},
];
