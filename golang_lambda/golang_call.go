package main

import (
	"os"
	"fmt"
)

func main() {
	arg := os.Args[1]
	fmt.Printf("Payload: %s\n", arg)
}


