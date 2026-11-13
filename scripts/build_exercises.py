#!/usr/bin/env python3
"""Genera la biblioteca de ejercicios del panel a partir de
https://github.com/hasaneyldrm/exercises-dataset (clonado en $DATASET_DIR).

Uso:  DATASET_DIR=/ruta/exercises-dataset python3 scripts/build_exercises.py

- Copia las miniaturas 180x180 a web/public/exercises/
- Escribe web/public/data/exercises.json (solo campos usados, ~10x más ligero)
- Añade name_es desde scripts/exercise-names-es.tsv (nombres traducidos al español)
- Las instrucciones en español vienen del propio dataset (instruction_steps.es)
Media © Gym visual — https://gymvisual.com/ (ver EXERCISES_NOTICE.md).
"""
import json, os, shutil, sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = os.environ.get('DATASET_DIR') or sys.exit('Define DATASET_DIR con la ruta del dataset.')
names = dict(l.rstrip('\n').split('\t', 1) for l in open(os.path.join(root, 'scripts/exercise-names-es.tsv'), encoding='utf8') if l.strip())
data = json.load(open(os.path.join(src, 'data/exercises.json'), encoding='utf8'))
out_img = os.path.join(root, 'web/public/exercises')
os.makedirs(out_img, exist_ok=True)
rows = []
for x in data:
    img = os.path.basename(x['image'])
    shutil.copyfile(os.path.join(src, x['image']), os.path.join(out_img, img))
    steps = x.get('instruction_steps', {})
    rows.append({
        'id': x['id'], 'name': x['name'], 'name_es': names.get(x['id']) or x['name'],
        'category': x['category'], 'body_part': x['body_part'], 'target': x['target'],
        'equipment': x['equipment'], 'muscle_group': x['muscle_group'],
        'secondary_muscles': x.get('secondary_muscles', []),
        'instruction_steps': {'es': steps.get('es', []), 'en': steps.get('en', [])},
        'image': f'exercises/{img}', 'media_id': x['media_id'],
        'gif': f"https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/{x['gif_url']}",
    })
rows.sort(key=lambda r: r['name_es'].lower())
json.dump(rows, open(os.path.join(root, 'web/public/data/exercises.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'ejercicios')
