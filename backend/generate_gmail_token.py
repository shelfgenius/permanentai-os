"""
Ruleaza o singura data pentru a genera gmail_token.json.
Necesita client_secret.json in acelasi folder.
"""
import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_PATH = "gmail_token.json"
SECRET_PATH = "client_secret.json"

if not os.path.exists(SECRET_PATH):
    print(f"EROARE: {SECRET_PATH} nu a fost gasit.")
    print("Descarca fisierul din Google Cloud Console si pune-l in folderul backend/")
    exit(1)

creds = None
if os.path.exists(TOKEN_PATH):
    creds = Credentials.from_authorized_user_file(TOKEN_PATH, SCOPES)

if not creds or not creds.valid:
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        flow = InstalledAppFlow.from_client_secrets_file(SECRET_PATH, SCOPES)
        creds = flow.run_local_server(port=58055)
    with open(TOKEN_PATH, "w") as f:
        f.write(creds.to_json())

print(f"\nSucces! Token salvat in: {TOKEN_PATH}")
print("Acum poti porni aplicatia cu START.bat")
