# Using local package for Python lambdas

The lambda executor supporting the Python runtime (`galacticfog/gestalt-laser-executor-python`) includes a number of popular modules. It is possible to use modules that are not present in the
runtime (including private/proprietary packages) by packaging them with the lambda script.

In this example, we will utilize the Python redis client. The module is imported in the lambda script like so: 
```
import redis
```

To package the redis module with your lambda, install it to the local directory as follows: 
```
pip2.7 install -t . redis
```

Then package the lambda script, all local modules, and any other scripts or resources into a zip archive: 
```
zip -r ../redis.zip *
```

Upload the zip archive to a local that is avaible to the executors running on your cluster. Register a new lambda, making sure to mark the `Compressed` checkbox next to the
`Package URL`. The `Lambda Handler` box should contain the relative path to the lambda script, with respect to the archive: 
![creating the redis lambda in the gestalt UI](https://github.com/GalacticFog/lambda-examples/raw/master/python_lambda/redis/img/redis-lambda-create.png "Creating the redis lambda")

For this test lambda, you will also need to set Variable indicating the hostname and port for the redis server:
![setting lambda variables in the gestalt UI](https://github.com/GalacticFog/lambda-examples/raw/master/python_lambda/redis/img/setting-lambda-vars.png "Setting redis variables for the lambda")
