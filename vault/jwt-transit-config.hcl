path "transit/keys/jwt-signing" {
  type = "aes256-gcm96"
  exportable = false
  allow_plaintext_backup = false
  deletion_allowed = false
}

path "transit/encrypt/jwt-signing" {
  capabilities = ["create", "update"]
}

path "transit/decrypt/jwt-signing" {
  capabilities = ["create", "update"]
}

path "transit/keys/jwt-signing/rotate" {
  capabilities = ["update"]
}

# Policy for API service
path "transit/sign/jwt-signing" {
  capabilities = ["create", "update"]
}

path "transit/verify/jwt-signing" {
  capabilities = ["create", "update"]
}