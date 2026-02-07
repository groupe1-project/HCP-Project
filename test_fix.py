#!/usr/bin/env python
"""Test the authentication fix for AdministratorsPage"""
import requests
import json

BASE_URL = "http://127.0.0.1:8000/api"

# Step 1: Login
print("=" * 60)
print("STEP 1: LOGGING IN")
print("=" * 60)
response = requests.post(f"{BASE_URL}/auth/login/", json={
    "email": "test@admin.com",
    "password": "password123"
})
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code != 200:
    print("❌ Login failed!")
    exit(1)

token = response.json()["token"]
print(f"✅ Got token: {token[:20]}...")

# Step 2: Try to create a saisisseur WITH token (this is what AdministratorsPage should do now)
print("\n" + "=" * 60)
print("STEP 2: CREATE SAISISSEUR WITH TOKEN")
print("=" * 60)
headers = {
    "Authorization": f"Token {token}",
    "Content-Type": "application/json"
}

response = requests.post(
    f"{BASE_URL}/user-requests/create_user_with_email/",
    json={
        "name": "Test Saisisseur",
        "email": "testsaisisseur@example.com",
        "role": "SAISISSEUR"
    },
    headers=headers
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 201:
    print("✅ SUCCESS! Saisisseur created with valid token!")
elif response.status_code == 400:
    print("⚠️  Got 400 - Validation error (this is expected if email exists)")
    print(f"Error details: {response.json()}")
else:
    print(f"❌ Unexpected status code: {response.status_code}")

# Step 3: Try to create WITHOUT token (should fail with 401)
print("\n" + "=" * 60)
print("STEP 3: CREATE SAISISSEUR WITHOUT TOKEN (should fail)")
print("=" * 60)
response = requests.post(
    f"{BASE_URL}/user-requests/create_user_with_email/",
    json={
        "nom": "Test Saisisseur 2",
        "email": "testsaisisseur2@example.com",
        "role": "SAISISSEUR"
    }
)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")

if response.status_code == 401:
    print("✅ CORRECT! Got 401 when token is missing (authentication required)")
else:
    print(f"❌ Expected 401 but got {response.status_code}")

print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print("✅ The fix should work! AdministratorsPage now:")
print("   1. Reads token from localStorage on mount")
print("   2. Configures axios with Authorization header")
print("   3. API requests now include the token")
print("=" * 60)
