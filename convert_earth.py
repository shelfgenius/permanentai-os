import bpy
import sys
import os

# Clear scene
bpy.ops.wm.open_mainfile(filepath=r"C:\Users\maher\Downloads\59-earth\earth 2.blend")

# Select all mesh objects
for obj in bpy.data.objects:
    obj.select_set(True)

# Export as GLB
output = r"C:\Users\maher\Desktop\retail-engine\frontend\public\earth.glb"
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
print(f"Exported to {output}")
