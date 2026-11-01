# KisanSetu on EC2

The EC2 override publishes Nginx on port 80 and keeps the gateway and other
backend services internal. React uses `/api` on the same host.

## Instance prerequisites

- A Linux EC2 instance with a public address, SSH access, Docker Engine and
  Docker Compose 2.24.4 or newer.
- Allow inbound SSH (22) from your administrator IP and HTTP (80) from the
  intended visitors. Do not expose ports 8000–8003 or MongoDB ports.
- For public production logins, configure a domain and HTTPS before collecting
  credentials. This override provides HTTP only.

Official setup references:
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-container-image.html
- https://docs.docker.com/compose/install/linux/
- https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/creating-security-group.html

## Application setup

Copy the project source to the instance, excluding `.env`, `node_modules`,
`frontend/dist`, `.git`, local databases, storage and test output. Transfer
credentials separately over SSH, or create `.env` directly on the instance.
Never place SSH keys inside the project or Docker build context.

From the project directory on the instance:

```sh
cp .env.example .env
chmod 600 .env
# Edit .env: set a random JWT_SECRET of at least 32 characters.
# Set CORS_ORIGINS to the site's exact origin, e.g. http://YOUR_EC2_PUBLIC_IP.
# Configure MONGODB_URI and MONGODB_DB if using Atlas.
```

For Atlas, allow the instance's public outbound IP in the Atlas access list.
Use a rotated database password rather than the credential previously shared
in chat. Leave MONGODB_URI empty only if intentionally using SQLite on EC2.
Local Docker volumes are not automatically copied to EC2. Migrate existing
accounts and farms to Atlas using the root README instructions before switching
deployments, or explicitly back up and transfer both SQLite volumes.

```sh
docker compose -f docker-compose.yml -f compose.ec2.yaml config --quiet
docker compose -f docker-compose.yml -f compose.ec2.yaml build
# When using Atlas, verify connectivity before starting the application:
docker compose -f docker-compose.yml -f compose.ec2.yaml run --rm --no-deps auth-service node scripts/check-mongo.js
docker compose -f docker-compose.yml -f compose.ec2.yaml up -d --wait --wait-timeout 180
docker compose -f docker-compose.yml -f compose.ec2.yaml ps
curl --fail http://localhost/
# Expected HTTP 401 for an unsigned-in visitor:
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/api/auth/me
```

Open `http://YOUR_EC2_PUBLIC_IP`. Docker restart policies restart the containers
after an instance reboot when Docker is enabled as a system service.
Do not use `down -v`; that deletes persistent volumes.
