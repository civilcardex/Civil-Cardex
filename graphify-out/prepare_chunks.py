import json
from pathlib import Path
import math

detect = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding='utf-16'))
all_uncached = Path('graphify-out/.graphify_uncached.txt').read_text(encoding='utf-8').strip().split('\n')
all_uncached = [f for f in all_uncached if f.strip()]

# Filter to only non-code files (documents + images)
doc_files = set(detect['files'].get('document', []))
image_files = set(detect['files'].get('image', []))
video_files = set(detect['files'].get('video', []))
paper_files = set(detect['files'].get('paper', []))

semantic_files = []
for f in all_uncached:
    if f in doc_files or f in image_files or f in video_files or f in paper_files:
        semantic_files.append(f)

# Sort by directory to group related files
semantic_files.sort()

# Group into chunks of ~22 files
CHUNK_SIZE = 22
chunks = []
for i in range(0, len(semantic_files), CHUNK_SIZE):
    chunks.append(semantic_files[i:i+CHUNK_SIZE])

# Save chunk info as JSON
root = Path('.').resolve()
chunk_info = []
for idx, chunk in enumerate(chunks):
    chunk_path = root / f'graphify-out/.graphify_chunk_{idx+1:02d}.json'
    file_list = '\n'.join(chunk)
    chunk_info.append({
        'chunk_num': idx + 1,
        'total_chunks': len(chunks),
        'files': chunk,
        'file_count': len(chunk),
        'chunk_path': str(chunk_path)
    })

Path('graphify-out/.graphify_chunks.json').write_text(json.dumps(chunk_info, indent=2, ensure_ascii=False), encoding='utf-8')
print(f'{len(chunks)} chunks, {len(semantic_files)} non-code files')
for ci in chunk_info:
    print(f"  Chunk {ci['chunk_num']:02d}/{ci['total_chunks']}: {ci['file_count']} files")
