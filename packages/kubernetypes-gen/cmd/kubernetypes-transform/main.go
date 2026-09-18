package main

import (
	"encoding/json"
	"kubernetypes-gen/internal/kubernetypes"
	"os"
)

func main() {
	input := new(kubernetypes.TransformInput)
	if err := json.NewDecoder(os.Stdin).Decode(input); err != nil {
		throw(err)
	}
	output, err := kubernetypes.Transform(input)
	if err != nil {
		throw(err)
	}
	_ = json.NewEncoder(os.Stdout).Encode(output)
}

func throw(err error) {
	_, _ = os.Stderr.WriteString(err.Error() + "\n")
	os.Exit(1)
}
