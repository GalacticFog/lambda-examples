#!/bin/bash
#set -x

echo "HELLO world"

echo "data : $1"
echo "context : $2"

data_meta_host=$(echo $1 | jq -r '.meta_host')
data_meta_port=$(echo $1 | jq -r '.meta_port')
data_security_host=$(echo $1 | jq -r '.security_host')
data_security_port=$(echo $1 | jq -r '.security_port')
data_username=$(echo $1 | jq -r '.username')
data_password=$(echo $1 | jq -r '.password')

meta=$data_meta_host:$data_meta_port
security=$data_security_host:$data_security_port
username=$data_username
password=$data_password

token=$(http --ignore-stdin -f $security/root/oauth/issue grant_type=password username=$username password=$password | jq -r '.access_token' )
#token=$(http -f $security/root/oauth/issue grant_type=password username=$username password=$password | jq -r '.access_token' )

echo "token : $token"

providers=$(http --ignore-stdin $meta/root/providers "Authorization:Bearer $token")
#providers=$(http $meta/root/providers "Authorization:Bearer $token")

echo "providers : $providers"

return_success "$providers"
