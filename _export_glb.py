import json, struct, sys

f = open(r'c:\Users\maher\Desktop\retail-engine\frontend\public\mustang.glb', 'rb')
f.read(4); f.read(4); f.read(4)
jlen = struct.unpack('<I', f.read(4))[0]; f.read(4)
d = json.loads(f.read(jlen).decode('utf-8')); f.close()
for i, n in enumerate(d.get('nodes', [])):
    nm = n.get('name', '?')
    s = n.get('scale', '')
    t = n.get('translation', '')
    m = n.get('mesh', '')
    parts = [f"[{i}] {nm}"]
    if m != '': parts.append(f"mesh={m}")
    if s: parts.append(f"scale={[round(x,3) for x in s]}")
    if t: parts.append(f"pos={[round(x,3) for x in t]}")
    print("  " + " | ".join(parts))
