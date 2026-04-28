import os
import glob

dirs = ['packages/cli/src', 'packages/core/src']
for d in dirs:
    for root, _, files in os.walk(d):
        for file in files:
            if not file.endswith(('.ts', '.tsx')): continue
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
            if 'GEMINI.md' in content or 'gemini.md' in content:
                content = content.replace('GEMINI.md', 'SEGA.md').replace('gemini.md', 'sega.md')
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                print(f'Replaced in {path}')
