#!/usr/bin/env python3
"""
Gera um FBX ASCII de teste "pesado" (~1-2MB) com geometria simples mas muitos vértices.
FBX ASCII é texto, fácil de gerar programaticamente.
"""
import math

LAT_SEGMENTS = 180
LON_SEGMENTS = 180

vertices = []
faces = []

for i in range(LAT_SEGMENTS + 1):
    theta = i * math.pi / LAT_SEGMENTS
    for j in range(LON_SEGMENTS + 1):
        phi = j * 2 * math.pi / LON_SEGMENTS
        x = math.sin(theta) * math.cos(phi)
        y = math.cos(theta)
        z = math.sin(theta) * math.sin(phi)
        vertices.append((x, y, z))

for i in range(LAT_SEGMENTS):
    for j in range(LON_SEGMENTS):
        v0 = i * (LON_SEGMENTS + 1) + j
        v1 = i * (LON_SEGMENTS + 1) + j + 1
        v2 = (i + 1) * (LON_SEGMENTS + 1) + j + 1
        v3 = (i + 1) * (LON_SEGMENTS + 1) + j
        faces.append((v0, v1, v2))
        faces.append((v0, v2, v3))

vertices_str = ",".join("{:.6f},{:.6f},{:.6f}".format(v[0], v[1], v[2]) for v in vertices)
faces_str = ",".join("{},{},{}".format(f[0], f[1], f[2]) for f in faces)
normals_str = ",".join("{:.6f},{:.6f},{:.6f}".format(v[0], v[1], v[2]) for v in vertices[:3000])

header = (
    "; FBX 7.4.0 project file\n"
    "FBXHeaderExtension:  {\n"
    "    FBXHeaderVersion: 1003\n"
    "    FBXVersion: 7400\n"
    "}\n"
    "Definitions:  {\n"
    "    Version: 100\n"
    "    Count: 2\n"
    '    ObjectType: "Geometry" {\n'
    "        Count: 1\n"
    "    }\n"
    '    ObjectType: "Model" {\n'
    "        Count: 1\n"
    "    }\n"
    "}\n"
    "Objects:  {\n"
    '    Geometry: 54321, "Geometry::HeavySphere", "Mesh" {\n'
    "        Vertices: *" + vertices_str + "\n"
    "        PolygonVertexIndex: *" + faces_str + "\n"
    "        GeometryVersion: 124\n"
    "        LayerElementNormal: 0 {\n"
    "            Version: 101\n"
    '            Name: ""\n'
    '            MappingInformationType: "ByPolygonVertex"\n'
    '            ReferenceInformationType: "Direct"\n'
    "            Normals: *" + normals_str + "\n"
    "        }\n"
    "    }\n"
    '    Model: 12345, "Model::HeavySphere", "Mesh" {\n'
    "        Version: 232\n"
    "        Properties70:  {\n"
    "        }\n"
    "    }\n"
    "}\n"
    "Connections:  {\n"
    '    C: "OO",54321,12345\n'
    "}\n"
)

with open('/home/z/my-project/download/test_heavy.fbx', 'w') as f:
    f.write(header)

import os
size = os.path.getsize('/home/z/my-project/download/test_heavy.fbx')
print("FBX criado: /home/z/my-project/download/test_heavy.fbx")
print("Tamanho: {:.2f} MB ({} bytes)".format(size/1024/1024, size))
print("Vertices: {}".format(len(vertices)))
print("Triangulos: {}".format(len(faces)))
