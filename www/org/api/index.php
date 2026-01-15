<?php
// API Proxy / Gateway
// Forwards requests to the hidden OpenGPSR Backend

// Load configuration
// Ensure you have a config.php with 'backend_url'
$config = require __DIR__ . '/../src/config.example.php';
if (file_exists(__DIR__ . '/../src/config.php')) {
    $config = require __DIR__ . '/../src/config.php';
}

$backendUrl = $config['backend_url'] ?? 'http://localhost:3000';

// Get current path relative to this script
// Request URI: /org/api/v1/entities
// Script Dir: /org/api
// Target Path: /api/v1/entities (We need to map exactly or strip prefix)

// Assumption: The backend exposes /api/...
// We want www/org/api/... to map to BACKEND/api/... OR BACKEND/...

// Let's assume www/org/api/v1/entities -> BACKEND/api/v1/entities
// So we need to construct the target URL.

$requestUri = $_SERVER['REQUEST_URI'];
$scriptName = $_SERVER['SCRIPT_NAME']; // /org/api/index.php

// Simple matching:
// If request is exactly /org/api/ or /org/api/index.php, serve documentation
if ($requestUri === '/org/api/' || $requestUri === '/org/api/index.php' || $requestUri === '/api/' || $requestUri === '/api/index.php') {
    readfile('docs.html');
    exit;
}

// Otherwise, proxy the request
// We need to determine the path part after /api/
// Logic depends on server config, but let's try to pass everything.

// Strip the directory of this script from the URI to get the relative path
$baseDir = dirname($scriptName); // /org/api
$path = substr($requestUri, strlen($baseDir)); // /v1/entities...

$targetUrl = rtrim($backendUrl, '/') . '/api' . $path;

// Prepare headers
$requestHeaders = [];
foreach (getallheaders() as $key => $value) {
    if (strtolower($key) !== 'host' && strtolower($key) !== 'content-length') {
        $requestHeaders[] = "$key: $value";
    }
}

// Init cURL
$ch = curl_init($targetUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);
curl_setopt($ch, CURLOPT_HEADER, true); // Get headers back

// Method
$method = $_SERVER['REQUEST_METHOD'];
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

// Body
if ($method !== 'GET') {
    curl_setopt($ch, CURLOPT_POSTFIELDS, file_get_contents('php://input'));
}

// Execute
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);

// Separate headers and body
$responseHeaders = substr($response, 0, $headerSize);
$responseBody = substr($response, $headerSize);

curl_close($ch);

// Output headers
$headers = explode("\r\n", $responseHeaders);
foreach ($headers as $header) {
    if (!empty($header) && stripos($header, 'Transfer-Encoding') === false) {
        header($header);
    }
}

echo $responseBody;
