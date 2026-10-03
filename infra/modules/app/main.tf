locals {
  prefix = "${var.name}-${var.environment}"
}

# --- Hetzner: VPS + firewall ---

resource "hcloud_ssh_key" "deploy" {
  count      = length(var.ssh_public_keys)
  name       = "${local.prefix}-${count.index}"
  public_key = var.ssh_public_keys[count.index]
}

resource "hcloud_firewall" "app" {
  name = local.prefix

  rule {
    description = "SSH"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = var.admin_cidrs
  }

  rule {
    description = "HTTP (ACME + redirect)"
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }

  rule {
    description = "HTTPS"
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }

  rule {
    description = "HTTP/3"
    direction   = "in"
    protocol    = "udp"
    port        = "443"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "app" {
  name         = local.prefix
  server_type  = var.server_type
  location     = var.location
  image        = var.image
  ssh_keys     = hcloud_ssh_key.deploy[*].id
  firewall_ids = [hcloud_firewall.app.id]
  user_data = templatefile("${path.module}/cloud-init.yaml", {
    ssh_public_keys = var.ssh_public_keys
  })

  labels = {
    app         = var.name
    environment = var.environment
  }

  lifecycle {
    ignore_changes = [user_data, image]
  }
}

# --- Cloudflare: DNS API (bez proxy; TLS robi Caddy) ---

resource "cloudflare_dns_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_hostname
  type    = "A"
  content = hcloud_server.app.ipv4_address
  ttl     = 300
  proxied = false
}

resource "cloudflare_dns_record" "api_v6" {
  zone_id = var.cloudflare_zone_id
  name    = var.api_hostname
  type    = "AAAA"
  content = hcloud_server.app.ipv6_address
  ttl     = 300
  proxied = false
}

# --- Cloudflare R2: backupy bazy z retencją ---

resource "cloudflare_r2_bucket" "backups" {
  account_id = var.cloudflare_account_id
  name       = "${local.prefix}-backups"
  location   = "eeur"
}

resource "cloudflare_r2_bucket_lifecycle" "backups" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.backups.name
  rules = [{
    id      = "expire-backups"
    enabled = true
    conditions = {
      prefix = ""
    }
    delete_objects_transition = {
      condition = {
        type    = "Age"
        max_age = var.backup_retention_days * 86400
      }
    }
  }]
}
