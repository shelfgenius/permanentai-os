import fitz  # pymupdf
import os, zipfile

pdfs = [
    r"C:\Users\maher\Downloads\construction_ai_spec.pdf",
    r"C:\Users\maher\Downloads\construction_ai_full_spec_detailed.pdf",
    r"C:\Users\maher\Downloads\construction_ai_production_spec.pdf",
]

out_dir = r"C:\Users\maher\Desktop\retail-engine"

for pdf_path in pdfs:
    name = os.path.splitext(os.path.basename(pdf_path))[0]
    out_path = os.path.join(out_dir, f"_{name}.txt")
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"OK: {name} -> {len(text)} chars")
    except Exception as e:
        print(f"FAIL: {name}: {e}")

# Extract zip
zip_path = r"C:\Users\maher\Downloads\OKComputer_Untitled_Chat (2).zip"
zip_out = os.path.join(out_dir, "_chat_zip")
try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(zip_out)
    print(f"ZIP extracted to {zip_out}")
    for root, dirs, files in os.walk(zip_out):
        for f in files:
            print(f"  {os.path.join(root, f)}")
except Exception as e:
    print(f"ZIP FAIL: {e}")
