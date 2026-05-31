/** Valorant API UUID → display name (Riot match API) */

export const AGENT_BY_UUID = {
  '5f8d3a7f-467b-97f3-062c-13acf203c006': 'Breach',
  'f94c3b30-42be-e959-889c-5aa313dba261': 'Raze',
  '6f2a04ca-43e0-be17-7f36-b3908627744d': 'Skye',
  '117ed9e3-49f3-6512-3ccf-0cada7e3823b': 'Cypher',
  '320b2a48-4d9b-a075-30f1-1f93a9b638fa': 'Sova',
  '1e58de9c-4950-5125-93e9-a0aee9f98746': 'Killjoy',
  '707eab51-4836-f488-046a-cda6bf494859': 'Viper',
  'eb93336a-449b-9c1b-0a54-a891f7921d69': 'Phoenix',
  '9f0d8ba9-4140-b941-57d3-a7ad57c6b417': 'Brimstone',
  '7f94d92c-4234-0a36-9646-3a87eb8b5c89': 'Yoru',
  '569fdd95-4d10-43ab-ca70-79becc718b46': 'Sage',
  'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc': 'Reyna',
  '8e253930-4c05-31dd-1b6c-968525494517': 'Omen',
  'add6443a-41bd-e414-f6ad-e58d267f4e95': 'Jett',
  '22697a3d-45bf-fdd4-45fe-b739-a386a8838bbb': 'Chamber',
  '41fb69c3-736b-8a85-2767-8e52787a283f': 'Astra',
  '601dbbe7-4439-ac39-8e41-cbcfb16b6920': 'Iso',
  '4cc6354c-4774-6af3-6b8df4ba279a': 'Deadlock',
  'e08cc852-4821-41c6-b928-1c5680f9abd8': 'Gekko',
  '95b78ed7-463b-8628-e22a-77a9d15c4158': 'Harbor',
  '5ffd37c0-4443-0b22-3536-c46e85e1f7d4': 'Fade',
  'e370fa57-4757-3604-3648-499772f47585': 'Neon',
  'a945ebd6-4871-7eca-06f9-5eb9e309544c': 'KAY/O',
  '2ecbda2d-4483-4d3-b333-667e44a6893a': 'Clove',
};

/** Internal map folder name → display name from matchInfo.mapId path */
export const MAP_BY_CODENAME = {
  Ascent: 'Ascent',
  Bonsai: 'Split',
  Duality: 'Bind',
  Triad: 'Haven',
  Port: 'Icebox',
  Foxtrot: 'Breeze',
  Canyon: 'Fracture',
  Pitt: 'Pearl',
  Jam: 'Lotus',
  Julius: 'Sunset',
  Infinity: 'Abyss',
  Rook: 'Corrode',
  Range: 'The Range',
  Poveglia: 'The Range',
};

export function resolveAgentName(characterId) {
  if (!characterId) return '';
  const id = String(characterId).toLowerCase();
  return AGENT_BY_UUID[id] || '';
}

export function resolveMapName(mapId) {
  if (!mapId) return '';
  const segment = String(mapId).split('/').filter(Boolean).pop() ?? '';
  if (MAP_BY_CODENAME[segment]) return MAP_BY_CODENAME[segment];
  if (/^[A-Z]/.test(segment)) return segment;
  return segment;
}
