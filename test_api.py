import urllib.request
import json

def main():
    # 1. D'abord se connecter pour obtenir un token
    print("=== STEP 1: Login pour obtenir un token ===")
    login_url = 'http://127.0.0.1:8000/api/auth/login/'
    login_data = {
        'email': 'admin@admin.com',  # À adapter selon vos données
        'password': 'admin'  # À adapter selon vos données
    }

    data_bytes = json.dumps(login_data).encode('utf-8')
    req = urllib.request.Request(login_url, data=data_bytes, method='POST')
    req.add_header('Content-Type', 'application/json')

    token = None
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
            token = result.get('token')
            print(f"✓ Login successful! Token: {token[:20]}...")
    except urllib.error.HTTPError as e:
        print(f"✗ Login failed: {e.code}")
        print(f"Response: {e.read().decode()}")
        raise SystemExit(1)

    # 2. Ensuite créer un utilisateur avec le token
    print("\n=== STEP 2: Créer un utilisateur avec le token ===")
    url = 'http://127.0.0.1:8000/api/user-requests/create_user_with_email/'
    data = {
        'name': 'Test User',
        'email': 'newuser@test.com',
        'role': 'SAISISSEUR'
    }

    data_bytes = json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=data_bytes, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('Authorization', f'Token {token}')

    try:
        with urllib.request.urlopen(req) as response:
            print(f"Status: {response.status}")
            result = json.loads(response.read().decode())
            print(f"✓ Success! Response: {json.dumps(result, indent=2)}")
    except urllib.error.HTTPError as e:
        print(f"✗ Failed: {e.code}")
        error_response = e.read().decode()
        print(f"Response: {error_response}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == '__main__':
    main()


