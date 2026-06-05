import json
from pathlib import Path

ast_path = Path('graphify-out/.graphify_ast.json')
sem_path = Path('graphify-out/.graphify_semantic_new.json')

ast = json.loads(ast_path.read_text(encoding='utf-8'))
sem = json.loads(sem_path.read_text(encoding='utf-8')) if sem_path.exists() else {'nodes':[],'edges':[],'hyperedges':[]}

seen = {n['id'] for n in ast['nodes']}
merged_nodes = list(ast['nodes'])
for n in sem['nodes']:
    if n['id'] not in seen:
        merged_nodes.append(n)
        seen.add(n['id'])

merged_edges = ast['edges'] + sem['edges']
merged_hyperedges = sem.get('hyperedges', [])
merged = {
    'nodes': merged_nodes,
    'edges': merged_edges,
    'hyperedges': merged_hyperedges,
    'input_tokens': sem.get('input_tokens', 0),
    'output_tokens': sem.get('output_tokens', 0),
}
Path('graphify-out/.graphify_extract.json').write_text(json.dumps(merged, indent=2, ensure_ascii=False), encoding='utf-8')
total = len(merged_nodes)
edge_count = len(merged_edges)
ast_count = len(ast['nodes'])
sem_count = len(sem['nodes'])
print(f'Merged: {total} nodes, {edge_count} edges ({ast_count} AST + {sem_count} semantic)')
