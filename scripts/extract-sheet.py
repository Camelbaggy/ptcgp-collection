#!/usr/bin/env python3
"""Build public/data/*.json from the raw tab dumps of the legacy Google Sheet.

Usage:  python3 -I scripts/extract-sheet.py [RAW_DIR] [OUT_DIR]
        (defaults: /tmp/ptcgp/raw  and  <repo>/public/data)

RAW_DIR must contain (each = JSON {"range":..., "values":[[...]]} as returned by Sheets get_values,
split in several files if the tab is big; files are concatenated in name order):
  cards_*.json     'Cards list'!A1:J<last>       (first file starts with the header row)
  inv_*.json       Inventaire!A1:H<last>         (first row is a header-like row, skipped)
  hist_add_*.json  'Historique ajout'!A2:D<last> (newest first; Date, Set, Nom, Version)
  trades.txt       lines "dd/mm HH:MM setOut numOut setIn numIn"   (from 'Historique echange')
  shares.txt       lines "dd/mm HH:MM set num"                      (from 'Historique partage')
Rate tables come from scripts/extract-rates-spec.json (transcribed from the 'Calculs <set>' tabs).
The same script can be pointed at an .xlsx export converted to these JSON files.
"""
import glob, json, os, re, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = sys.argv[1] if len(sys.argv) > 1 else '/tmp/ptcgp/raw'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', 'public', 'data')
os.makedirs(OUT, exist_ok=True)

RARITY = {'D1': 'D1', 'D2': 'D2', 'D3': 'D3', 'EX': 'D4', 'D4': 'D4', 'E1': 'E1', 'E2': 'E2', 'E3': 'E3',
          'S1': 'S1', 'S2': 'S2', 'C1': 'C1', 'Promo': 'P', '': 'P'}

SET_NAMES = {  # (French, English or None). Names are not in the sheet: French derived from the slugs in Listes!K.
    'A1': ("Puissance génétique", "Genetic Apex"), 'A1a': ("L'île fabuleuse", "Mythical Island"),
    'A2': ("Choc spatio-temporel", "Space-Time Smackdown"), 'A2a': ("Lumière triomphale", "Triumphant Light"),
    'A2b': ("Réjouissances rayonnantes", "Shining Revelry"), 'A3': ("Gardiens astraux", "Celestial Guardians"),
    'A3a': ("Crise interdimensionnelle", "Extradimensional Crisis"), 'A3b': ("La clairière d'Évoli", "Eevee Grove"),
    'A4': ("Sagesse entre ciel et mer", "Wisdom of Sea and Sky"), 'A4a': ("Source secrète", "Secluded Springs"),
    'A4b': ("Booster de luxe EX", "Deluxe Pack: ex"), 'B1': ("Méga-ascension", "Mega Rising"),
    'B1a': ("Embrasement écarlate", "Crimson Blaze"), 'B2': ("Parade onirique", "Fantastical Parade"),
    'B2a': ("Merveilles de Paldea", "Paldean Wonders"), 'B2b': ("Méga-rayonnement", "Mega Shine"),
    'B3': ("Aura palpitante", None), 'B3a': ("Propulsion paradoxe", None), 'B3b': ("Jours heureux", None),
    'B4': ("Domination céleste", None), 'B4a': ("L'ambition de la Team Rocket", None),
    'B4b': ("Booster de luxe Méga", None), 'C1': ("Fusion double", None),
    'P-A': ("Promo-A", "Promo-A"), 'P-B': ("Promo-B", "Promo-B"), 'P-C': ("Promo-C", "Promo-C"), 'SP1': ("SP1", None),
}
SET_ORDER = list(SET_NAMES)  # release order (A, then B, then C, then promos)
# Baby Pokemon of the 6th-slot pool (by English name). NB: the sheet's regex in 'Calculs A4'!G2 uses French names
# (Magby|Lippouti|Débugant|Pichu|Elekid|Mélo) and misses 'Debugant' and 'Électriqueid'.
BABY_EN = {'A4': {'Magby', 'Pichu', 'Elekid', 'Smoochum', 'Cleffa', 'Tyrogue'}, 'A4a': {'Igglybuff', 'Azurill', 'Mantyke'}}


def load(pattern):
    rows = []
    for f in sorted(glob.glob(os.path.join(RAW, pattern))):
        rows += json.load(open(f, encoding='utf-8'))['values']
    return rows


def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1 if name != 'history.json' else None, separators=(',', ': ') if name != 'history.json' else (',', ':'))
    print(f'{name}: {len(obj)}')


# ---------------------------------------------------------------- cards / boosters / sets
cl = load('cards_*.json')[1:]
cl = [r + [''] * (10 - len(r)) for r in cl if r and r[0]]
boosters = collections.OrderedDict()   # id -> dict
for r in cl:
    setid, deck = r[0], r[1]
    if setid.startswith('P-') or setid == 'SP1':
        continue  # promo sets: not obtainable from boosters
    if deck in ('Tous', ''):
        continue
    bid = f'{setid}-{deck}'
    boosters.setdefault(bid, {'id': bid, 'setId': setid, 'name': SET_NAMES[setid][0] if deck == 'Unique' else deck})
boosters = sorted(boosters.values(), key=lambda b: (SET_ORDER.index(b['setId']), b['id']))
by_set = collections.defaultdict(list)
for b in boosters:
    by_set[b['setId']].append(b['id'])


def row_boosters(setid, deck):
    if setid not in by_set:
        return []
    if deck in ('Tous', ''):
        return list(by_set[setid])
    return [f'{setid}-{deck}']


cards = collections.OrderedDict()
image_sources = {}
set_row_map = {}  # (set, '#') -> id (last wins, like the Apps Script)
for r in cl:
    setid, deck, num, name, name_en, typ, stage, rar, cid, finish = r[:10]
    set_row_map[(setid, num)] = cid
    m = re.match(r'^(.*?)-(-?\d+)$', cid)
    home, number = (m.group(1), int(m.group(2))) if m else (setid, int(num))
    if rar not in RARITY:
        raise SystemExit(f'unknown rarity {rar!r} for {cid}')
    c = cards.get(cid)
    if c is None:
        c = {'id': cid, 'setId': home, 'number': number, 'name': name, 'nameEn': name_en or None, 'type': typ or None,
             'stage': stage or None, 'rarity': RARITY[rar], 'boosterIds': []}
        if finish:
            c['finish'] = finish
        cards[cid] = c
    for b in row_boosters(setid, deck):
        if b not in c['boosterIds']:
            c['boosterIds'].append(b)
# Deluxe packs (A4b/B4b) hold reprints of D1-D3 cards (id of their original set, finish "Normale" = left empty)
# and new "Brillante" cards (id = deluxe set). B4b has the finish in column J; infer it for A4b.
for c in cards.values():
    if c['setId'] not in ('A4b', 'B4b'):
        c.pop('finish', None)
    elif c['setId'] == 'A4b' and c['rarity'] in ('D1', 'D2', 'D3'):
        c['finish'] = 'Brillante'
cards_list = []
for c in cards.values():
    out = {k: v for k, v in c.items() if v is not None}
    out['image'] = ''
    cards_list.append(out)
cards_list.sort(key=lambda c: (SET_ORDER.index(c['setId']) if c['setId'] in SET_ORDER else 99, c['number'], c['id']))
card_ids = {c['id'] for c in cards_list}

sets = []
for i, sid in enumerate(SET_ORDER):
    if not any(c['setId'] == sid for c in cards_list):
        continue
    nm, en = SET_NAMES[sid]
    s = {'id': sid, 'name': nm, 'order': i + 1}
    if en:
        s['nameEn'] = en
    sets.append(s)

# ---------------------------------------------------------------- rates
spec = json.load(open(os.path.join(HERE, 'extract-rates-spec.json'), encoding='utf-8'))
cards_by_booster = collections.defaultdict(list)
for c in cards_list:
    for b in c['boosterIds']:
        cards_by_booster[b].append(c)


def agg_slot(sl):
    if 'byFinish' in sl:
        tot = collections.defaultdict(float)
        for fin in sl['byFinish'].values():
            for k, v in fin.items():
                tot[k] += v
        out = {'slot': sl['slot'], 'rates': {k: round(v, 3) for k, v in tot.items()}, 'byFinish': sl['byFinish']}
        return out
    return {'slot': sl['slot'], 'rates': dict(sl['rates'])}


rates = []
for b in boosters:
    sid = b['setId']
    babies = [c['id'] for c in cards_by_booster[b['id']] if c.get('nameEn') in BABY_EN[sid] and c['rarity'] in ('D3', 'E1')] if sid in BABY_EN else []
    if sid in spec['custom']:
        packs = [{'packType': p['packType'], 'packTypeRate': p['packTypeRate'], 'slots': [agg_slot(s) for s in p['slots']]}
                 for p in spec['custom'][sid]]
    else:
        sp = spec['sets'][sid]
        pre = spec['presets'][sp['preset']]
        s4 = {**pre['s4'], **sp.get('ov4', {})}
        s5 = {**pre['s5'], **sp.get('ov5', {})}
        normal = [{'slot': i, 'rates': {'D1': 100}} for i in (1, 2, 3)] + [{'slot': 4, 'rates': s4}, {'slot': 5, 'rates': s5}]
        if babies:
            normal = [dict(s, excludeCardIds=babies) for s in normal]
        packs = []
        for t, rate in sp['types'].items():
            if t == 'normal':
                slots = normal
            elif t == 'plus1':
                if babies:
                    s6 = {'slot': 6, 'rates': sp['babySlot6'], 'poolCardIds': babies}
                else:
                    s6 = {'slot': 6, 'rates': pre['s6']}
                slots = normal + [s6]
            elif t == 'rare':
                slots = [{'slot': i, 'rates': sp['rare']} for i in range(1, 6)]
            elif t == 'rare-s2':
                slots = [{'slot': i, 'rates': sp['rareS2']} for i in range(1, 6)]
            packs.append({'packType': t, 'packTypeRate': rate, 'slots': slots})
    for p in packs:
        rates.append({'boosterId': b['id'], **p})

# ---------------------------------------------------------------- owned
inv = load('inv_*.json')
owned = []
for r in inv:
    if len(r) >= 4 and r[0] in card_ids:
        owned.append({'cardId': r[0], 'quantity': int(r[3] or 0)})
inv_total = None
for r in inv:
    if len(r) >= 8 and r[6] == 'Total':
        inv_total = int(r[7].replace(' ', '').replace(' ', ''))
owned_total = sum(o['quantity'] for o in owned)
unknown_inv = [r[0] for r in inv if r and r[0] and r[0] not in card_ids]

# ---------------------------------------------------------------- history
def parse_ver(v):
    m = re.match(r'^\s*(-?\d+)', v or '')
    return m.group(1) if m else None


def assign_years(rows, newest_year=2026):
    """rows newest first, each with 'dd/mm HH:MM'. Year decrements when month jumps up going back in time."""
    year, prev_m, out = newest_year, None, []
    for r in rows:
        d, mo = int(r[:2]), int(r[3:5])
        if prev_m is not None and mo > prev_m + 0:
            year -= 1
        prev_m = mo
        out.append(f'{year}-{mo:02d}-{d:02d}T{r[6:11]}')
    return out


history = []
unresolved = 0
# packs: group consecutive rows (same minute + same set), chunks of <= 6 cards (Ajout form size)
add = [r for r in load('hist_add_*.json') if len(r) >= 4]
dates = assign_years([r[0] for r in add])
i = 0
packs_ev = []
while i < len(add):
    j = i
    while j < len(add) and add[j][0] == add[i][0] and add[j][1] == add[i][1]:
        j += 1
    grp = list(range(i, j))
    for k in range(0, len(grp), 6):
        ch = grp[k:k + 6]
        ids = []
        for x in ch:
            n = parse_ver(add[x][3])
            cid = set_row_map.get((add[x][1], n))
            if cid in card_ids:
                ids.append(cid)
            else:
                unresolved += 1
        if ids:
            packs_ev.append((dates[i], add[i][1], ids))
    i = j
for n, (dt, sid, ids) in enumerate(reversed(packs_ev)):  # oldest first -> stable ids
    cand = None
    for cid in ids:
        bs = set(next(c for c in cards_list if c['id'] == cid)['boosterIds']) & set(by_set.get(sid, []))
        if len(bs) == 1 or cand is None:
            cand = bs if len(bs) == 1 else (cand or bs)
        if len(bs) == 1:
            cand = bs
            break
    bid = sorted(cand)[0] if cand else (by_set[sid][0] if by_set.get(sid) else f'{sid}-Unique')
    history.append({'id': f'p{n + 1}', 'kind': 'pack', 'date': dt, 'boosterId': bid, 'cardIds': ids})


def read_lines(name):
    p = os.path.join(RAW, name)
    return [l.split() for l in open(p, encoding='utf-8').read().splitlines() if l.strip()] if os.path.exists(p) else []


tr = read_lines('trades.txt')
tdates = assign_years([' '.join(l[:2]) for l in tr])
for n, (l, dt) in enumerate(reversed(list(zip(tr, tdates)))):
    g, rc = set_row_map.get((l[2], l[3])), set_row_map.get((l[4], l[5]))
    if g in card_ids and rc in card_ids:
        history.append({'id': f't{n + 1}', 'kind': 'trade', 'date': dt, 'given': g, 'received': rc})
    else:
        unresolved += 1
sh = read_lines('shares.txt')
sdates = assign_years([' '.join(l[:2]) for l in sh])
for n, (l, dt) in enumerate(reversed(list(zip(sh, sdates)))):
    cid = set_row_map.get((l[2], l[3]))
    if cid in card_ids:
        history.append({'id': f's{n + 1}', 'kind': 'share', 'date': dt, 'cardId': cid, 'direction': 'given'})
    else:
        unresolved += 1
history.sort(key=lambda e: (e['date'], e['id']))

# ---------------------------------------------------------------- write + validate
dump('sets.json', sets)
dump('boosters.json', boosters)
dump('cards.json', cards_list)
dump('rates.json', rates)
dump('owned.json', owned)
dump('history.json', history)
SLUGS = {'A1': 'puissance-genetique', 'A1a': 'l-ile-fabuleuse', 'A2': 'choc-spatio-temporel', 'A2a': 'lumiere-triomphale',
         'A2b': 'rejouissances-rayonnantes', 'A3': 'gardiens-astraux', 'A3a': 'crise-interdimensionnelle',
         'A3b': 'la-clairiere-d-evoli', 'A4': 'sagesse-entre-ciel-et-mer', 'A4a': 'source-secrete',
         'A4b': 'booster-de-luxe-ex', 'B1': 'mega-ascension', 'B1a': 'embrasement-ecarlate', 'B2': 'parade-onirique',
         'B2a': 'merveilles-de-paldea', 'B2b': 'mega-rayonnement', 'B3': 'aura-palpitante', 'B3a': 'propulsion-paradoxe',
         'B3b': 'jours-heureux', 'B4': 'domination-celeste', 'B4a': 'l-ambition-de-la-team-rocket',
         'B4b': 'booster-de-luxe-mega', 'C1': 'fusion-double', 'P-A': 'promo-a', 'P-B': 'promo-b', 'P-C': 'promo-c', 'SP1': 'sp1'}
with open(os.path.join(OUT, 'set-slugs.json'), 'w', encoding='utf-8') as f:  # slugs used by the sheet's Set/# column (community site URLs)
    json.dump(SLUGS, f, ensure_ascii=False, indent=1)

print('--- validation')
cnt = collections.Counter(c['setId'] for c in cards_list)
print('cards per set:', dict(cnt))
print('boosters:', len(boosters), ' rates packs:', len(rates))
print('owned total', owned_total, 'expected (Inventaire!H1)', inv_total, 'owned rows', len(owned), 'unknown inventory ids', unknown_inv)
print('cards without owned row:', len(card_ids - {o['cardId'] for o in owned}))
print('history', collections.Counter(e['kind'] for e in history), 'unresolved lines', unresolved)
for b in boosters:
    sp = [r for r in rates if r['boosterId'] == b['id']]
    tot = round(sum(r['packTypeRate'] for r in sp), 3)
    if abs(tot - 100) > 0.01:
        print('WARN packTypeRate sum', b['id'], tot)
    for r in sp:
        for s in r['slots']:
            t = round(sum(s['rates'].values()), 2)
            if abs(t - 100) > 0.05:
                print('WARN slot sum', b['id'], r['packType'], s['slot'], t)
    # rarities with a slot rate but no card in the booster
    rar = {c['rarity'] for c in cards_by_booster[b['id']]}
    for r in sp:
        for s in r['slots']:
            for k, v in s['rates'].items():
                if v > 0 and k not in rar:
                    print('WARN rate for rarity without card', b['id'], r['packType'], s['slot'], k)
                    break
