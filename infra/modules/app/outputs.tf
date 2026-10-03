output "server_ipv4" {
  value = hcloud_server.app.ipv4_address
}

output "api_url" {
  value = "https://${var.api_hostname}"
}

output "backup_bucket" {
  value = cloudflare_r2_bucket.backups.name
}
