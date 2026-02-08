[databases]
nextgen_marketplace = host=${primary_db_host} port=${primary_db_port} dbname=${primary_db_name} pool_size=${default_pool_size}
%{ for idx, replica_url in read_replica_urls ~}
nextgen_read_${idx} = ${replica_url} pool_size=${default_pool_size}
%{ endfor ~}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = ${listen_port}
auth_type = ${auth_type}
auth_file = ${auth_file}

# Connection pooling
pool_mode = ${pool_mode}
max_client_conn = ${max_client_conn}
default_pool_size = ${default_pool_size}
reserve_pool_size = ${reserve_pool_size}
reserve_pool_timeout = ${reserve_pool_timeout}
max_db_connections = ${max_db_connections}

# Timeouts
server_reset_query = ${server_reset_query}
server_check_query = ${server_check_query}
server_check_delay = ${server_check_delay}
query_timeout = ${query_timeout}
query_wait_timeout = ${query_wait_timeout}
client_idle_timeout = ${client_idle_timeout}
server_idle_timeout = ${server_idle_timeout}
server_lifetime = ${server_lifetime}
server_connect_timeout = ${server_connect_timeout}
client_login_timeout = ${client_login_timeout}

# Admin
admin_users = ${admin_users}
stats_users = ${stats_users}

# Logging
log_connections = ${log_connections}
log_disconnections = ${log_disconnections}
log_pooler_errors = ${log_pooler_errors}
syslog = 0
syslog_facility = daemon
syslog_ident = pgbouncer

# Security
ignore_startup_parameters = extra_float_digits

# Performance tuning
tcp_keepalives_idle = 600
tcp_keepalives_interval = 30
tcp_keepalives_count = 3
tcp_user_timeout = 30000