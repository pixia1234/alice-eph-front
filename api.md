# Ephemera API 2.0

- Base URL: `https://app.alice.ws/cli/v1`
- Auth: `Authorization: Bearer <clientId:clientSecret>` (from Alice EVO CLI credentials)
- All endpoints return JSON. Bodies use `application/json`.

## Account

### GET /account/profile
获取用户基本信息
**Response example**:
```json
{
  "code": 200,
  "data": {
    "address_1": " Default address",
    "address_2": null,
    "city": "Default City",
    "country": "Zimbabwe",
    "credit": 11111,
    "default_card": -1,
    "email": "test@alice.ws",
    "fullname": "Default Full Name",
    "github_id": null,
    "google_id": null,
    "grade": 1,
    "id": 1,
    "language": "zh-cn",
    "lastlogin_date": "2025-11-23T10:43:09Z",
    "lastlogin_ip": "127.0.0.1",
    "max_instances": 10,
    "points": 126970,
    "points_spent": 19960,
    "postcode": "00001",
    "register_date": "2024-10-26T17:29:57+01:00",
    "register_ip": "127.0.0.1",
    "risk_amnesty_period": "2024-11-17T22:40:58Z",
    "status": 1,
    "total_spent": 13853400,
    "updated_at": "2025-11-23T12:00:43Z",
    "username": "test"
  },
  "message": "success"
}
```

### GET /account/ssh-keys
获取SSH密钥列表
**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "id": 1095,
      "user_id": 1,
      "name": "1",
      "node": 1,
      "sid": 1101,
      "publickey": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCyUEQYcKpo7njfpUNIVcczkJ/CoKjA6gTSxZXaS5xn9+KPgavshThgLeRP1AESY3/J/U81FTceosbve/Z4SmHKN0C/DoslztT5lJ4BQgAvn7wAvagwnrbV5tNxahoH8G1otbuh69EVgXIwFB1m0K1PdxyJC2gXIBvezMUSk5HOJAT81lrZAyNTDJ9Jtl5zvEPH3buMPNnY+9bwQVmUBHA4p78qUBmZ4fFNW6vc1UKD+hAboo1L8SH78erFgeOntRFmT0874/e9oc4AO96TmYhMSA4dbT13vMl1PtbU6nBWGokRL81r9xd4ZPuIM9GFyGTzscJ5XqiJ8VluO5/lZKMz",
      "created_at": "2025-10-13T06:36:29+01:00"
    }
  ],
  "message": "Success"
}
```

## EVO Instances

### GET /evo/permissions
获取EVO权限信息
**Response example**:
```json
{
  "code": 200,
  "data": {
    "allow_packages": "38|39|40|41|42",
    "max_time": 999,
    "plan": "Ephemera.VelocityX",
    "plan_id": 3,
    "user_id": 1
  },
  "message": "EVO permissions"
}
```

### GET /evo/plans
获取可用的EVO计划列表
**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "id": 38,
      "group_id": 7,
      "type": "evo-server",
      "name": "SLC.Evo.Micro",
      "billing_mode": 1,
      "hidden": 1,
      "stock": 87,
      "vm_hour_price": 0,
      "backup_hour_price": 0,
      "additional_hour_price": 0,
      "traffic_price": 0,
      "disk_type": "NVMe",
      "cpu": 2,
      "memory": 4096,
      "disk": 60,
      "upload_speed": 64000,
      "download_speed": 640000,
      "show_speed": "500↑ / 5000↓ Mbps",
      "os": "1|2|3|4|5|6|7|8|9|10|13",
      "region": 2,
      "node": 1,
      "resource_pricing_group": 3,
      "supports_ipv4": 1,
      "supports_ipv6": 1,
      "default_ipv4_count": 1,
      "max_ipv4_count": 1,
      "supports_backup": 0,
      "backup_count": 0,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "routes": "No Route Guarantee",
      "recommend": 0,
      "api_config": "{\"packageId\":\"2\",\"hypervisorId\":\"10\",\"backupPlan\":\"1\"}",
      "created_at": "0001-01-01T00:00:00Z",
      "updated_at": "2025-11-23T16:17:35Z",
      "status": 1
    },
    {
      "id": 39,
      "group_id": 7,
      "type": "evo-server",
      "name": "SLC.Evo.Standard",
      "billing_mode": 1,
      "hidden": 1,
      "stock": 77,
      "vm_hour_price": 0,
      "backup_hour_price": 0,
      "additional_hour_price": 0,
      "traffic_price": 0,
      "disk_type": "NVMe",
      "cpu": 4,
      "memory": 8192,
      "disk": 120,
      "upload_speed": 64000,
      "download_speed": 640000,
      "show_speed": "500↑ / 5000↓ Mbps",
      "os": "1|2|3|4|5|6|7|8|9|10|13",
      "region": 2,
      "node": 1,
      "resource_pricing_group": 3,
      "supports_ipv4": 1,
      "supports_ipv6": 1,
      "default_ipv4_count": 1,
      "max_ipv4_count": 1,
      "supports_backup": 0,
      "backup_count": 0,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "routes": "No Route Guarantee",
      "recommend": 0,
      "api_config": "{\"packageId\":\"2\",\"hypervisorId\":\"10\",\"backupPlan\":\"1\"}",
      "created_at": "0001-01-01T00:00:00Z",
      "updated_at": "2025-11-23T06:14:00Z",
      "status": 1
    },
    {
      "id": 40,
      "group_id": 7,
      "type": "evo-server",
      "name": "SLC.Evo.Pro",
      "billing_mode": 1,
      "hidden": 1,
      "stock": 100,
      "vm_hour_price": 0,
      "backup_hour_price": 0,
      "additional_hour_price": 0,
      "traffic_price": 0,
      "disk_type": "NVMe",
      "cpu": 8,
      "memory": 16384,
      "disk": 200,
      "upload_speed": 64000,
      "download_speed": 640000,
      "show_speed": "500↑ / 5000↓ Mbps",
      "os": "1|2|3|4|5|6|7|8|9|10|13",
      "region": 2,
      "node": 1,
      "resource_pricing_group": 3,
      "supports_ipv4": 1,
      "supports_ipv6": 1,
      "default_ipv4_count": 1,
      "max_ipv4_count": 1,
      "supports_backup": 0,
      "backup_count": 0,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "routes": "No Route Guarantee",
      "recommend": 0,
      "api_config": "{\"packageId\":\"2\",\"hypervisorId\":\"10\",\"backupPlan\":\"1\"}",
      "created_at": "0001-01-01T00:00:00Z",
      "updated_at": "2025-11-16T17:58:53Z",
      "status": 1
    },
    {
      "id": 41,
      "group_id": 7,
      "type": "evo-server",
      "name": "SLC.Evo.Ultra",
      "billing_mode": 1,
      "hidden": 1,
      "stock": 98,
      "vm_hour_price": 0,
      "backup_hour_price": 0,
      "additional_hour_price": 0,
      "traffic_price": 0,
      "disk_type": "NVMe",
      "cpu": 16,
      "memory": 32768,
      "disk": 300,
      "upload_speed": 64000,
      "download_speed": 640000,
      "show_speed": "500↑ / 5000↓ Mbps",
      "os": "1|2|3|4|5|6|7|8|9|10|13",
      "region": 2,
      "node": 1,
      "resource_pricing_group": 3,
      "supports_ipv4": 1,
      "supports_ipv6": 1,
      "default_ipv4_count": 1,
      "max_ipv4_count": 1,
      "supports_backup": 0,
      "backup_count": 0,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "routes": "No Route Guarantee",
      "recommend": 0,
      "api_config": "{\"packageId\":\"2\",\"hypervisorId\":\"10\",\"backupPlan\":\"1\"}",
      "created_at": "0001-01-01T00:00:00Z",
      "updated_at": "2025-11-22T09:16:19Z",
      "status": 1
    },
    {
      "id": 42,
      "group_id": 7,
      "type": "evo-server",
      "name": "SLC.Evo.GPU-Ultra",
      "billing_mode": 1,
      "hidden": 1,
      "stock": 1,
      "vm_hour_price": 0,
      "backup_hour_price": 0,
      "additional_hour_price": 0,
      "traffic_price": 0,
      "disk_type": "NVMe",
      "cpu": 8,
      "memory": 32768,
      "disk": 1000,
      "gpu": "NVIDIA RTX A4000",
      "upload_speed": 64000,
      "download_speed": 640000,
      "show_speed": "500↑ / 5000↓ Mbps",
      "os": "1|2|3|4|5|6|7|8|9|10|13",
      "region": 2,
      "node": 1,
      "resource_pricing_group": 3,
      "supports_ipv4": 1,
      "supports_ipv6": 1,
      "default_ipv4_count": 1,
      "max_ipv4_count": 1,
      "supports_backup": 0,
      "backup_count": 0,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "routes": "No Route Guarantee",
      "recommend": 0,
      "api_config": "{\"packageId\":\"2\",\"hypervisorId\":\"10\",\"backupPlan\":\"1\"}",
      "created_at": "0001-01-01T00:00:00Z",
      "updated_at": "2025-10-05T15:55:05+01:00",
      "status": 0
    }
  ],
  "message": "Success"
}
```

### GET /evo/plans/:id/os-images
根据计划ID获取可用的OS镜像列表
**Path params**:
- `id`: Plan ID
**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "group_id": 4,
      "group_name": "AlmaLinux",
      "logo": "/assets/image/logos/os-alma-linux.svg",
      "os_list": [
        {
          "id": 7,
          "name": "AlmaLinux 8 Minimal",
          "port": 22,
          "username": "root"
        },
        {
          "id": 8,
          "name": "AlmaLinux 9 Latest",
          "port": 22,
          "username": "root"
        }
      ]
    },
    {
      "group_id": 6,
      "group_name": "Alpine Linux",
      "logo": "/assets/image/logos/alpine_logo.png",
      "os_list": [
        {
          "id": 9,
          "name": "Alpine Linux 3.19",
          "port": 22,
          "username": "root"
        }
      ]
    },
    {
      "group_id": 1,
      "group_name": "Debian",
      "logo": "/assets/image/logos/os-debian.svg",
      "os_list": [
        {
          "id": 1,
          "name": "Debian 12 (Bookworm) Minimal",
          "port": 22,
          "username": "root"
        },
        {
          "id": 2,
          "name": "Debian 11 (Bullseye) Minimal",
          "port": 22,
          "username": "root"
        },
        {
          "id": 10,
          "name": "Debian 12 DevKit",
          "port": 22,
          "username": "root"
        },
        {
          "id": 13,
          "name": "Debian 13 (Trixie) Minimal",
          "port": 22,
          "username": "root"
        }
      ]
    },
    {
      "group_id": 2,
      "group_name": "Ubuntu",
      "logo": "/assets/image/logos/os-ubuntu.svg",
      "os_list": [
        {
          "id": 3,
          "name": "Ubuntu Server 20.04 LTS Minimal",
          "port": 22,
          "username": "root"
        },
        {
          "id": 4,
          "name": "Ubuntu Server 22.04 LTS Minimal",
          "port": 22,
          "username": "root"
        }
      ]
    },
    {
      "group_id": 3,
      "group_name": "Centos",
      "logo": "/assets/image/logos/os-centos.svg",
      "os_list": [
        {
          "id": 5,
          "name": "CentOS 7 Minimal",
          "port": 22,
          "username": "root"
        },
        {
          "id": 6,
          "name": "CentOS Stream 9 Minimal",
          "port": 22,
          "username": "root"
        }
      ]
    }
  ],
  "message": "Success"
}
```

### POST /evo/instances/deploy
部署新的EVO实例
参数说明：
product_id: 计划ID（必需）
os_id: 操作系统ID（必需）
time: 使用时长（小时）（必需）
ssh_key_id: SSH密钥ID（可选）
boot_script: Base64编码的启动脚本（可选）
**Request body example**:
```json
{
  "product_id": 38,
  "os_id": 1,
  "time": 24,
  "ssh_key_id": null,
  "boot_script": "c3VkbyBhcHQtZ2V0IGluc3RhbGwgY3VybApjdXJsIC1zIGh0dHBzOi8vcGFja2FnZWNsb3VkLmlvL2luc3RhbGwvcmVwb3NpdG9yaWVzL29va2xhL3NwZWVkdGVzdC1jbGkvc2NyaXB0LmRlYi5zaCB8IHN1ZG8gYmFzaApzdWRvIGFwdC1nZXQgaW5zdGFsbCBzcGVlZHRlc3Q="
}
```
**Response example**:
```json
{
  "code": 200,
  "data": {
    "boot_script_uid": "82b0996d-301b-4a8e-b3a8-dcb2024ce5c4",
    "cpu": 2,
    "cpu_name": "AMD EPYC™ 9654 Genoa",
    "creation_at": "2025-11-23 14:25:25",
    "disk": 60,
    "disk_type": "NVMe",
    "download_speed": 640000,
    "expiration_at": "2025-11-24 14:25:25",
    "hostname": "kuraya.evo.host.aliceinit.dev",
    "id": 15238,
    "ipv4": "31.22.111.24",
    "ipv6": "2a14:67c0:601::16",
    "memory": 4096,
    "os": "Debian 12 (Bookworm) Minimal",
    "os_group": "Debian",
    "os_group_id": 1,
    "os_id": 1,
    "password": "BKyOxmy01fKiB3jU4zeJ",
    "plan": "SLC.Evo.Micro",
    "plan_id": 38,
    "region": "Salt Lake City",
    "region_id": 2,
    "routes": "No Route Guarantee",
    "show_speed": "500↑ / 5000↓ Mbps",
    "status": "active",
    "uid": "89d69459-f25d-4c38-96bb-ee452de88b9f",
    "upload_speed": 64000,
    "user": "root"
  },
  "message": "Created successfully!"
}
```

### GET /evo/instances
获取当前用户的所有EVO实例列表
**Response example**:
```json
{
  "code": 200,
  "data": [
    {
      "cpu": 2,
      "cpu_name": "AMD EPYC™ 9654 Genoa",
      "creation_at": "2025-11-23T14:25:25Z",
      "disk": "60",
      "disk_type": "NVMe",
      "download_speed": 640000,
      "expiration_at": "2025-11-24T14:25:25Z",
      "hostname": "test.evo.host.aliceinit.dev",
      "id": 15238,
      "ipv4": "31.22.111.24",
      "ipv6": "2a14:67c0:601::16",
      "last_recorded_traffic": null,
      "last_reset_at": null,
      "memory": 4096,
      "os": "Debian 12 (Bookworm) Minimal",
      "os_group": "Debian",
      "os_group_id": 1,
      "os_id": 1,
      "password": "BKyOxmy01fKiB3jU4zeJ",
      "plan": "SLC.Evo.Micro",
      "plan_id": 38,
      "region": "Salt Lake City",
      "region_id": 2,
      "routes": "No Route Guarantee",
      "show_speed": "500↑ / 5000↓ Mbps",
      "status": "active",
      "uid": "89d69459-f25d-4c38-96bb-ee452de88b9f",
      "upload_speed": 64000,
      "user": "root"
    }
  ],
  "message": "success"
}
```

### DELETE /evo/instances/:id
删除（销毁）指定的EVO实例
**Path params**:
- `id`: Instance ID
**Response example**:
```json
{
  "code": 200,
  "data": null,
  "message": "Destroyed successfully!"
}
```

### GET /evo/instances/:id/state
获取EVO实例的详细状态信息
**Path params**:
- `id`: Instance ID
**Response example**:
```json
{
  "code": 200,
  "data": {
    "cpu": 2,
    "cpu_name": "AMD EPYC™ 9654 Genoa",
    "disk": 60,
    "download_speed": 640000,
    "ipv4": [
      {
        "address": "31.22.111.24",
        "gateway": "31.22.111.1",
        "netmask": "255.255.255.0",
        "resolver1": "8.8.8.8",
        "resolver2": "8.8.4.4"
      }
    ],
    "ipv4_primary": "31.22.111.24",
    "ipv6": [
      {
        "subnet": "2a14:67c0:601::16",
        "cidr": 128,
        "gateway": "2a14:67c0:601::1",
        "resolver1": "2001:4860:4860::8888",
        "resolver2": "2001:4860:4860::8844",
        "addresses": [
          "2a14:67c0:601::16"
        ]
      }
    ],
    "ipv6_primary": "2a14:67c0:601::16",
    "memory": 4096,
    "name": "SLC.Evo.Micro",
    "state": {
      "memory": {
        "memtotal": 3861012,
        "memfree": 3375160,
        "memavailable": 3369640
      },
      "cpu": 0,
      "state": "running",
      "traffic": {
        "in": 137527,
        "out": 23452,
        "total": 160979
      }
    },
    "status": "complete",
    "system": {
      "group_name": "Debian",
      "logo": "/assets/image/logos/os-debian.svg",
      "name": "Debian 12 (Bookworm) Minimal",
      "path": "15"
    },
    "upload_speed": 64000
  },
  "message": null
}
```

### POST /evo/instances/:id/power
执行实例电源操作
可用的操作：
boot: 启动
shutdown: 关机
restart: 重启
poweroff: 强制关机
**Path params**:
- `id`: Instance ID
**Request body example**:
```json
{
  "action": "shutdown"
}
```
**Response example**:
```json
{
  "code": 200,
  "data": null,
  "message": "Success"
}
```

### POST /evo/instances/:id/rebuild
重装EVO实例系统
参数说明：
os_id: 操作系统ID（必需）
ssh_key_id: SSH密钥ID（可选）
boot_script: Base64编码的启动脚本（可选）
**Path params**:
- `id`: Instance ID
**Request body example**:
```json
{
  "os_id": 1,
  "ssh_key_id": null,
  "boot_script": "c3VkbyBhcHQtZ2V0IGluc3RhbGwgY3VybApjdXJsIC1zIGh0dHBzOi8vcGFja2FnZWNsb3VkLmlvL2luc3RhbGwvcmVwb3NpdG9yaWVzL29va2xhL3NwZWVkdGVzdC1jbGkvc2NyaXB0LmRlYi5zaCB8IHN1ZG8gYmFzaApzdWRvIGFwdC1nZXQgaW5zdGFsbCBzcGVlZHRlc3Q="
}
```
**Response example**:
```json
{
  "code": 200,
  "data": {
    "boot_script_uid": "0c9bbec9-99c0-44d0-bf79-9516f88862fa",
    "hostname": "test.evo.host.aliceinit.dev",
    "ipv4": "31.22.111.24",
    "ipv6": "2a14:67c0:601::16",
    "password": "nPczBLOcPBqYpJbZZAYK",
    "sshkey": null
  },
  "message": "Success"
}
```

### POST /evo/instances/:id/renewals
续费EVO实例
参数说明：
time: 续费时长（小时）（必需）
**Path params**:
- `id`: Instance ID
**Request body example**:
```json
{
  "time": 1
}
```
**Response example**:
```json
{
  "code": 200,
  "data": {
    "added_hours": 1,
    "expiration_at": "2025-11-24 16:42:26",
    "total_service_hours": 25
  },
  "message": "Server renewal successful. New expiration date: 2025-11-24 16:42:26"
}
```

### POST /evo/instances/:id/exec
在指定EVO实例上异步执行远程命令
参数说明：
id: 实例ID（URL路径参数，必需）
command: Base64编码的命令（必需）
返回command_uid用于查询执行结果
**Path params**:
- `id`: Instance ID
**Request body example**:
```json
{
  "command": "Y3VybCAtZnNTTCBodHRwczovL2dldC5kb2NrZXIuY29tIHwgc2gK"
}
```
**Response example**:
```json
{
  "code": 200,
  "data": {
    "command_uid": "44313048-1f5b-4c34-bae9-46135bf76a4e"
  },
  "message": "Command created successfully"
}
```

### GET /evo/instances/:id/exec/:uid
获取指定实例上的远程命令执行结果
参数说明：
id: 实例ID（URL路径参数，必需）
uid: 命令UID（URL路径参数，必需）
返回数据包含：
status: 命令状态
result: 执行结果
output: 命令输出
**Path params**:
- `id`: Instance ID
- `uid`: Command UID
**Response example**:
```json
{
  "code": 200,
  "data": {
    "output": "IyBFeGVjdXRpbmcgZG9ja2VyIGluc3RhbGwgc2NyaXB0LCBjb21taXQ6IDdkOTZiZDNjNTIzNWFiMjEyMWJjYjg1NWRkN2IzZjNmMzcxMjhlZDQKKyBzaCAtYyBhcHQtZ2V0IC1xcSB1cGRhdGUgPi9kZXYvbnVsbAorIHNoIC1jIERFQklBTl9GUk9OVEVORD1ub25pbnRlcmFjdGl2ZSBhcHQtZ2V0IC15IC1xcSBpbnN0YWxsIGNhLWNlcnRpZmljYXRlcyBjdXJsID4vZGV2L251bGwKKyBzaCAtYyBpbnN0YWxsIC1tIDA3NTUgLWQgL2V0Yy9hcHQva2V5cmluZ3MKKyBzaCAtYyBjdXJsIC1mc1NMICJodHRwczovL2Rvd25sb2FkLmRvY2tlci5jb20vbGludXgvZGViaWFuL2dwZyIgLW8gL2V0Yy9hcHQva2V5cmluZ3MvZG9ja2VyLmFzYworIHNoIC1jIGNobW9kIGErciAvZXRjL2FwdC9rZXlyaW5ncy9kb2NrZXIuYXNjCisgc2ggLWMgZWNobyAiZGViIFthcmNoPWFtZDY0IHNpZ25lZC1ieT0vZXRjL2FwdC9rZXlyaW5ncy9kb2NrZXIuYXNjXSBodHRwczovL2Rvd25sb2FkLmRvY2tlci5jb20vbGludXgvZGViaWFuIGJvb2t3b3JtIHN0YWJsZSIgPiAvZXRjL2FwdC9zb3VyY2VzLmxpc3QuZC9kb2NrZXIubGlzdAorIHNoIC1jIGFwdC1nZXQgLXFxIHVwZGF0ZSA+L2Rldi9udWxsCisgc2ggLWMgREVCSUFOX0ZST05URU5EPW5vbmludGVyYWN0aXZlIGFwdC1nZXQgLXkgLXFxIGluc3RhbGwgZG9ja2VyLWNlIGRvY2tlci1jZS1jbGkgY29udGFpbmVyZC5pbyBkb2NrZXItY29tcG9zZS1wbHVnaW4gZG9ja2VyLWNlLXJvb3RsZXNzLWV4dHJhcyBkb2NrZXItYnVpbGR4LXBsdWdpbiBkb2NrZXItbW9kZWwtcGx1Z2luID4vZGV2L251bGwKKyBzaCAtYyBkb2NrZXIgdmVyc2lvbgpDbGllbnQ6IERvY2tlciBFbmdpbmUgLSBDb21tdW5pdHkKIFZlcnNpb246ICAgICAgICAgICAyOS4wLjIKIEFQSSB2ZXJzaW9uOiAgICAgICAxLjUyCiBHbyB2ZXJzaW9uOiAgICAgICAgZ28xLjI1LjQKIEdpdCBjb21taXQ6ICAgICAgICA4MTA4MzU3CiBCdWlsdDogICAgICAgICAgICAgTW9uIE5vdiAxNyAxMjozMzo0MCAyMDI1CiBPUy9BcmNoOiAgICAgICAgICAgbGludXgvYW1kNjQKIENvbnRleHQ6ICAgICAgICAgICBkZWZhdWx0CgpTZXJ2ZXI6IERvY2tlciBFbmdpbmUgLSBDb21tdW5pdHkKIEVuZ2luZToKICBWZXJzaW9uOiAgICAgICAgICAyOS4wLjIKICBBUEkgdmVyc2lvbjogICAgICAxLjUyIChtaW5pbXVtIHZlcnNpb24gMS40NCkKICBHbyB2ZXJzaW9uOiAgICAgICBnbzEuMjUuNAogIEdpdCBjb21taXQ6ICAgICAgIGU5ZmYxMGIKICBCdWlsdDogICAgICAgICAgICBNb24gTm92IDE3IDEyOjMzOjQwIDIwMjUKICBPUy9BcmNoOiAgICAgICAgICBsaW51eC9hbWQ2NAogIEV4cGVyaW1lbnRhbDogICAgIGZhbHNlCiBjb250YWluZXJkOgogIFZlcnNpb246ICAgICAgICAgIHYyLjEuNQogIEdpdENvbW1pdDogICAgICAgIGZjZDQzMjIyZDZiMDczNzlhNGJlOTc4NmJkYTUyNDM4ZjBkZDE2YTEKIHJ1bmM6CiAgVmVyc2lvbjogICAgICAgICAgMS4zLjMKICBHaXRDb21taXQ6ICAgICAgICB2MS4zLjMtMC1nZDg0MmQ3NzEKIGRvY2tlci1pbml0OgogIFZlcnNpb246ICAgICAgICAgIDAuMTkuMAogIEdpdENvbW1pdDogICAgICAgIGRlNDBhZDAKCj09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09CgpUbyBydW4gRG9ja2VyIGFzIGEgbm9uLXByaXZpbGVnZWQgdXNlciwgY29uc2lkZXIgc2V0dGluZyB1cCB0aGUKRG9ja2VyIGRhZW1vbiBpbiByb290bGVzcyBtb2RlIGZvciB5b3VyIHVzZXI6CgogICAgZG9ja2VyZC1yb290bGVzcy1zZXR1cHRvb2wuc2ggaW5zdGFsbAoKVmlzaXQgaHR0cHM6Ly9kb2NzLmRvY2tlci5jb20vZ28vcm9vdGxlc3MvIHRvIGxlYXJuIGFib3V0IHJvb3RsZXNzIG1vZGUuCgoKVG8gcnVuIHRoZSBEb2NrZXIgZGFlbW9uIGFzIGEgZnVsbHkgcHJpdmlsZWdlZCBzZXJ2aWNlLCBidXQgZ3JhbnRpbmcgbm9uLXJvb3QKdXNlcnMgYWNjZXNzLCByZWZlciB0byBodHRwczovL2RvY3MuZG9ja2VyLmNvbS9nby9kYWVtb24tYWNjZXNzLwoKV0FSTklORzogQWNjZXNzIHRvIHRoZSByZW1vdGUgQVBJIG9uIGEgcHJpdmlsZWdlZCBEb2NrZXIgZGFlbW9uIGlzIGVxdWl2YWxlbnQKICAgICAgICAgdG8gcm9vdCBhY2Nlc3Mgb24gdGhlIGhvc3QuIFJlZmVyIHRvIHRoZSAnRG9ja2VyIGRhZW1vbiBhdHRhY2sgc3VyZmFjZScKICAgICAgICAgZG9jdW1lbnRhdGlvbiBmb3IgZGV0YWlsczogaHR0cHM6Ly9kb2NzLmRvY2tlci5jb20vZ28vYXR0YWNrLXN1cmZhY2UvCgo9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PQoK",
    "result": "success",
    "status": "fetched"
  },
  "message": "success"
}
```
