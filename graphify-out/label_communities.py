import json
from pathlib import Path

analysis = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding='utf-8'))

labels = {}
# Community name mapping for the most meaningful clusters
name_map = {
    "0": "JS Array & Cache Optimizations",
    "1": "Tailwind & SEO Patterns",
    "2": "React Composition Concepts",
    "3": "React Composition Rules",
    "4": "Node.js Backend Patterns",
    "5": "Rendering Performance",
    "6": "React Best Practices Guide",
    "7": "Vite Configuration & Plugin API",
    "8": "JS Performance Patterns",
    "9": "Rerender & Memo Patterns",
    "10": "Accessibility & WCAG",
    "11": "Hydration & Transition Patterns",
    "12": "Derived State & Dependencies",
    "13": "Server Cache Strategies",
    "14": "WCAG Conformance Levels",
    "15": "Client Data Fetching",
    "16": "Resource Hints & Script Loading",
    "17": "Bundle Optimization",
    "18": "Pipe Fittings - Expansion/Reduction",
    "19": "Pipe Fittings - 45/90 Elbows",
    "20": "Pipe Fittings - Long/Medium Radius",
    "21": "Pipe Fittings - Tee Connections",
    "22": "Pipe Fittings - Side/Reducing Tees",
    "23": "Pipe Fittings - Angle & Globe Valves",
    "24": "Pipe Fittings - Check & Gate Valves",
    "25": "Rerender Optimization Patterns",
    "26": "State Initialization Patterns",
    "27": "Server Actions Patterns",
    "28": "RSC Serialization Patterns",
    "29": "Parallel Fetching Patterns",
    "30": "Async Data Flow Patterns",
    "31": "Vite Build & SSR",
    "32": "Accessibility Skip Link",
    "33": "WCAG Changes",
}

for cid in analysis['communities']:
    nodes = analysis['communities'][cid]
    if cid in name_map:
        labels[cid] = name_map[cid]
    else:
        # Use first node's label as community name
        first_node = nodes[0] if nodes else "unknown"
        labels[cid] = first_node

Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding='utf-8')
print(f"Labeled {len(labels)} communities")
