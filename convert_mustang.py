import bpy
import sys
import os

# Open the Mustang blend file
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\maher\Downloads\mustang-extract\Mustang 13.04.2021 Compressed.blend")

# List all mesh object names to identify windows/hood to remove
print("\n=== All objects ===")
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print(f"  {obj.name}")

# Remove objects that are windows or hood based on name patterns
REMOVE_KEYWORDS = ['window', 'Window', 'glass', 'Glass', 'windshield', 'Windshield', 'hood', 'Hood', 'capot']
removed = []
for obj in list(bpy.data.objects):
    if obj.type == 'MESH':
        name_lower = obj.name.lower()
        if any(k.lower() in name_lower for k in REMOVE_KEYWORDS):
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)

print(f"\n=== Removed {len(removed)} objects ===")
for n in removed:
    print(f"  - {n}")

# Select all remaining meshes
for obj in bpy.data.objects:
    obj.select_set(True)

# Export as GLB
output = r"C:\Users\maher\Desktop\retail-engine\frontend\public\mustang.glb"
bpy.ops.export_scene.gltf(
    filepath=output,
    export_format='GLB',
    use_selection=False,
    export_apply=True,
    export_image_format='JPEG',
    export_jpeg_quality=85,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
)
print(f"\nExported to {output}")
