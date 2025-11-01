#!/bin/bash

# SSL Certificate Generation Script for Development and Testing
# For production, use Let's Encrypt or proper CA-signed certificates

set -e

# Create SSL directory
mkdir -p ssl

# Generate CA private key
openssl genrsa -out ssl/ca.key 4096

# Generate CA certificate
openssl req -new -x509 -days 365 -key ssl/ca.key -out ssl/ca.crt -subj "/C=US/ST=CA/L=San Francisco/O=Encrypted Email Service/CN=Encrypted Email CA"

# Generate MongoDB private key
openssl genrsa -out ssl/mongodb.key 2048

# Generate MongoDB certificate signing request
openssl req -new -key ssl/mongodb.key -out ssl/mongodb.csr -subj "/C=US/ST=CA/L=San Francisco/O=Encrypted Email Service/CN=mongodb"

# Generate MongoDB certificate
openssl x509 -req -in ssl/mongodb.csr -CA ssl/ca.crt -CAkey ssl/ca.key -CAcreateserial -out ssl/mongodb.crt -days 365

# Combine MongoDB certificate and key
cat ssl/mongodb.crt ssl/mongodb.key > ssl/mongodb.pem

# Generate Redis private key
openssl genrsa -out ssl/redis.key 2048

# Generate Redis certificate signing request
openssl req -new -key ssl/redis.key -out ssl/redis.csr -subj "/C=US/ST=CA/L=San Francisco/O=Encrypted Email Service/CN=redis"

# Generate Redis certificate
openssl x509 -req -in ssl/redis.csr -CA ssl/ca.crt -CAkey ssl/ca.key -CAcreateserial -out ssl/redis.crt -days 365

# Set proper permissions
chmod 600 ssl/*.key ssl/*.pem
chmod 644 ssl/*.crt ssl/ca.crt

# Clean up CSR files
rm ssl/*.csr

echo "SSL certificates generated successfully!"
echo "Files created:"
echo "  ssl/ca.crt - Certificate Authority certificate"
echo "  ssl/ca.key - Certificate Authority private key"
echo "  ssl/mongodb.pem - MongoDB certificate and key"
echo "  ssl/redis.crt - Redis certificate"
echo "  ssl/redis.key - Redis private key"
echo ""
echo "Note: These are self-signed certificates for development/testing only."
echo "For production, use Let's Encrypt or proper CA-signed certificates."