import secrets
import string

# Generate API Key (20 characters)
api_key = 'API' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(20))

# Generate API Secret (40 characters)
api_secret = 'secret' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))

print(f"LIVEKIT_API_KEY: {api_key}")
print(f"LIVEKIT_API_SECRET: {api_secret}")

# Run the script
