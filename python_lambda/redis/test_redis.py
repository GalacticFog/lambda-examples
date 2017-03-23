import sys
import redis 

data = sys.argv[1].data

r = redis.StrictRedis(host=data.redis.host, port=data.redis.port=6379, db=0)
r.set('foo', 'bar')
print(r.get('foo'))
