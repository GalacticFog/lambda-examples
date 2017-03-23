import sys
import json
import redis 

print(sys.argv[1])

redis_opts = json.loads(sys.argv[1])["data"]["redis"]

r = redis.StrictRedis(host=redis_opts["host"], port=redis_opts["port"], db=0)
r.set('foo', 'bar')
print(r.get('foo'))
