import os
import re

target_dir = os.path.expanduser("~/.cache/torch/hub/facebookresearch_dinov3_main/")

def fix_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    if "from __future__ import annotations" in content:
        return

    # Check if | is used in type hints (simplified check)
    if "|" in content:
        # Add at the top, after shebang if present
        lines = content.splitlines()
        if lines and lines[0].startswith("#!"):
            lines.insert(1, "from __future__ import annotations")
        else:
            lines.insert(0, "from __future__ import annotations")
        
        with open(file_path, 'w') as f:
            f.write("\n".join(lines) + "\n")
        print(f"Fixed {file_path}")

for root, dirs, files in os.walk(target_dir):
    for file in files:
        if file.endswith(".py"):
            fix_file(os.path.join(root, file))

