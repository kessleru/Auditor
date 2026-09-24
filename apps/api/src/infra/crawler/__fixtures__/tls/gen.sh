#!/usr/bin/env bash
# Gera a cadeia de teste (raiz → intermediária → folha para 127.0.0.1), com AIA na folha
# apontando para http://127.0.0.1:{porta}/intermediaria.der. Rodar de novo só se precisar trocar.
set -euo pipefail
cd "$(dirname "$0")"
openssl req -x509 -newkey rsa:2048 -nodes -keyout raiz.key -out raiz.pem -days 36500 -subj "/CN=Raiz de teste" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign,cRLSign"
openssl req -newkey rsa:2048 -nodes -keyout intermediaria.key -out intermediaria.csr -subj "/CN=Intermediaria de teste"
openssl x509 -req -in intermediaria.csr -CA raiz.pem -CAkey raiz.key -CAcreateserial -out intermediaria.pem -days 36500 \
  -extfile <(printf "basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign")
openssl x509 -in intermediaria.pem -outform der -out intermediaria.der
openssl req -newkey rsa:2048 -nodes -keyout folha.key -out folha.csr -subj "/CN=127.0.0.1"
openssl x509 -req -in folha.csr -CA intermediaria.pem -CAkey intermediaria.key -CAcreateserial -out folha.pem -days 36500 \
  -extfile <(printf "subjectAltName=IP:127.0.0.1\nauthorityInfoAccess=caIssuers;URI:http://127.0.0.1:47123/intermediaria.der\nbasicConstraints=CA:FALSE")
rm -f *.csr *.srl raiz.key intermediaria.key
