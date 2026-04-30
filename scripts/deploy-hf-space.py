"""
Deploy AURA Voice XTTS-v2 Space to Hugging Face.

Usage:
  1. Get a HF token from https://huggingface.co/settings/tokens (Write access)
  2. Run: python scripts/deploy-hf-space.py --token hf_YOUR_TOKEN
  
  Or login first: python -c "import huggingface_hub; huggingface_hub.login()"
  Then run:       python scripts/deploy-hf-space.py
"""

import argparse
import os
import sys

def main():
    parser = argparse.ArgumentParser(description="Deploy AURA Voice HF Space")
    parser.add_argument("--token", type=str, default=None, help="HF token (or login first)")
    parser.add_argument("--space-name", type=str, default="aura-voice", help="Space name")
    parser.add_argument("--org", type=str, default=None, help="HF org/username (auto-detected if logged in)")
    args = parser.parse_args()

    from huggingface_hub import HfApi, login

    # Login if token provided
    if args.token:
        login(token=args.token)
        print("[OK] Logged in with provided token")
    
    api = HfApi()
    
    # Get username
    try:
        user_info = api.whoami()
        username = args.org or user_info["name"]
        print(f"[OK] Logged in as: {username}")
    except Exception as e:
        print(f"[ERR] Not logged in. Please provide --token or run:")
        print(f"  python -c \"import huggingface_hub; huggingface_hub.login()\"")
        sys.exit(1)

    repo_id = f"{username}/{args.space_name}"
    space_dir = os.path.join(os.path.dirname(__file__), "..", "hf-space-xtts")
    space_dir = os.path.abspath(space_dir)

    print(f"\nDeploying Space: {repo_id}")
    print(f"Source: {space_dir}")

    # Create Space repo
    try:
        api.create_repo(
            repo_id=repo_id,
            repo_type="space",
            space_sdk="gradio",
            space_hardware="cpu-basic",  # Free tier (slower but works)
            exist_ok=True,
            private=False,
        )
        print(f"[OK] Space created/exists: https://huggingface.co/spaces/{repo_id}")
    except Exception as e:
        print(f"[ERR] Failed to create space: {e}")
        sys.exit(1)

    # Upload all files
    print("\nUploading files...")
    files_to_upload = []
    for root, dirs, files in os.walk(space_dir):
        for f in files:
            local_path = os.path.join(root, f)
            remote_path = os.path.relpath(local_path, space_dir).replace("\\", "/")
            files_to_upload.append((local_path, remote_path))

    for local_path, remote_path in files_to_upload:
        size = os.path.getsize(local_path)
        print(f"  >> {remote_path} ({size:,} bytes)")
        api.upload_file(
            path_or_fileobj=local_path,
            path_in_repo=remote_path,
            repo_id=repo_id,
            repo_type="space",
        )

    space_url = f"https://huggingface.co/spaces/{repo_id}"
    api_url = f"https://{username}-{args.space_name}.hf.space"

    print(f"\n{'='*55}")
    print(f"  [OK] Space deployed successfully!")
    print(f"{'='*55}")
    print(f"  Space URL:  {space_url}")
    print(f"  API URL:    {api_url}")
    print(f"")
    print(f"  Add this to your .env:")
    print(f"  AURA_XTTS_URL={api_url}")
    print(f"")
    print(f"  The Space will build and start automatically.")
    print(f"  First build takes ~5-10 minutes (model download).")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
