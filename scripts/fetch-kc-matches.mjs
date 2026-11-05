// Récupère les matchs de Karmine Corp (équipe LEC) sur PandaScore et les écrit dans data/kc-matches.json.
// Lancé toutes les 2 heures par .github/workflows/kc-matches.yml (le navigateur ne peut pas appeler PandaScore
// directement : l'API n'envoie pas d'en-têtes CORS). L'app lit seulement le fichier produit.
//
// Le jeton est volontairement en dur (demande du propriétaire). Le dépôt est public : si besoin, le régénérer sur
// https://app.pandascore.co/dashboard puis le changer ici.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const TOKEN = 'YwTQFx1B3aSqlYGTwL3LPqvnDZiL21naih6NnpqOVTEhoN4hKlw';
const TEAM_ID = 134078; // « Karmine Corp » (KC), équipe LEC : LEC, First Stand, MSI, Worlds, Esports World Cup
const OUT = 'data/kc-matches.json';
const DAY = 864e5;

async function get(page) {
  const p = new URLSearchParams({
    'filter[opponent_id]': String(TEAM_ID),
    'range[scheduled_at]': new Date(Date.now() - 2 * DAY).toISOString() + ',' + new Date(Date.now() + 400 * DAY).toISOString(),
    sort: 'scheduled_at',
    per_page: '100',
    page: String(page),
  });
  for (let essai = 0; essai < 3; essai++) {
    const r = await fetch('https://api.pandascore.co/lol/matches?' + p, { headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json' } });
    if (r.status === 429) { await new Promise(ok => setTimeout(ok, (Number(r.headers.get('retry-after')) || 5) * 1000)); continue; }
    if (!r.ok) throw new Error('PandaScore a répondu ' + r.status);
    return { rows: await r.json(), total: Number(r.headers.get('x-total')) || 0 };
  }
  throw new Error('PandaScore : trop de requêtes (429)');
}

const rows = [];
for (let page = 1; page <= 5; page++) {
  const { rows: r, total } = await get(page);
  rows.push(...r);
  if (rows.length >= total || r.length === 0) break;
}
if (!Array.isArray(rows)) throw new Error('Réponse inattendue');

const matches = rows.map(m => {
  const opp = (m.opponents || []).map(o => o.opponent).filter(Boolean).find(o => o.id !== TEAM_ID) || null;
  const round = (String(m.name || '').split(':')[0] || '').trim();
  return {
    id: m.id,
    status: m.status, // not_started, running, finished, canceled, postponed
    at: m.scheduled_at || null, // heure universelle (UTC)
    opp: opp ? { name: opp.name, acronym: opp.acronym || '' } : null, // null = adversaire pas encore connu
    bo: m.number_of_games || 0,
    league: (m.league && m.league.name) || '',
    serie: (m.serie && (m.serie.full_name || m.serie.name)) || '',
    stage: (m.tournament && m.tournament.name) || '',
    round: /:/.test(m.name || '') ? round : '',
  };
}).sort((a, b) => String(a.at).localeCompare(String(b.at)) || a.id - b.id);

// N'écrit que s'il y a du nouveau, ou une fois par jour (preuve de vie pour l'app).
let prev = null;
try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch (e) {}
const same = prev && JSON.stringify(prev.matches) === JSON.stringify(matches);
const age = prev && prev.generatedAt ? Date.now() - Date.parse(prev.generatedAt) : Infinity;
if (same && age < 20 * 3600e3) {
  console.log('Aucun changement (' + matches.length + ' matchs).');
} else {
  mkdirSync('data', { recursive: true });
  writeFileSync(OUT, JSON.stringify({ team: { id: TEAM_ID, name: 'Karmine Corp', acronym: 'KC' }, generatedAt: new Date().toISOString(), matches }, null, 1) + '\n');
  console.log((same ? 'Preuve de vie : ' : 'Mis à jour : ') + matches.length + ' matchs.');
}
