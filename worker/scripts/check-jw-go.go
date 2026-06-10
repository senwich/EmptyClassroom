package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
)

const loginURL = "http://jwglweixin.bupt.edu.cn/bjyddx/login"

type loginResponse struct {
	Code string `json:"code"`
	Msg  string `json:"Msg"`
	Data struct {
		Token string `json:"token"`
	} `json:"data"`
}

func loadDevVars() {
	content, err := os.ReadFile(".dev.vars")
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if os.Getenv(key) == "" {
			_ = os.Setenv(key, value)
		}
	}
}

func main() {
	loadDevVars()
	username := os.Getenv("JW_USERNAME")
	password := os.Getenv("JW_PASSWORD")
	if username == "" || password == "" {
		fmt.Fprintln(os.Stderr, "Missing JW_USERNAME or JW_PASSWORD")
		os.Exit(1)
	}

	req, err := http.NewRequest("POST", loginURL, nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	q := url.Values{}
	q.Add("userNo", username)
	q.Add("pwd", password)
	q.Add("encode", "1")
	q.Add("captchaData", "")
	q.Add("codeVal", "")
	req.URL.RawQuery = q.Encode()

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	var data loginResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if resp.StatusCode != 200 || data.Code != "1" || data.Data.Token == "" {
		fmt.Fprintf(os.Stderr, "Go-style login rejected: status=%d code=%s msg=%s\n", resp.StatusCode, data.Code, data.Msg)
		os.Exit(1)
	}
	fmt.Println("Go-style login ok")
}
