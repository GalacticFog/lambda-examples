import sys
import redis 
import os

redis_host = os.getenv('REDIS_HOST', 'localhost')
redis_port = os.getenv('REDIS_PORT', '6379')

print('creating redis client against {}:{}'.format(redis_host,redis_port))
r = redis.StrictRedis(host=redis_host, port=redis_port, db=0)
print('setting foo=bar')
r.set('foo', 'bar')
print('retrieving foo:')
print(r.get('foo'))
