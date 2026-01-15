<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Configure logic for production if needed
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

// Load config
$configPath = __DIR__ . '/config.php';
if (!file_exists($configPath)) {
    // Falls back to example if no config.php found (for demo purposes)
    // In production, this should error out if not configured.
    $config = require __DIR__ . '/config.example.php';
} else {
    $config = require $configPath;
}

$input = json_decode(file_get_contents('php://input'), true);

$name = trim($input['name'] ?? '');
$email = trim($input['email'] ?? '');
$subject = trim($input['subject'] ?? '');
$message = trim($input['message'] ?? '');

if (empty($name) || empty($email) || empty($message)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Simple mail using PHP mail() or custom SMTP logic
// For "copy-paste" simplicity, we use mail() if no library is present.
// If user needs SMTP, they usually need a library like PHPMailer or existing server config.
// Here we assume caching server mail() works or we construct a simple implementation.

$to = $config['to_email'];
$subject = "[OpenGPSR Website] " . $subject;
$headers = "From: " . $config['from_email'] . "\r\n";
$headers .= "Reply-To: " . $email . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/html; charset=UTF-8\r\n";

$body = "
<h3>New Message from Website</h3>
<p><strong>Name:</strong> " . htmlspecialchars($name) . "</p>
<p><strong>Email:</strong> " . htmlspecialchars($email) . "</p>
<hr>
<p>" . nl2br(htmlspecialchars($message)) . "</p>
";

if (mail($to, $subject, $body, $headers)) {
    echo json_encode(['success' => true, 'message' => 'Message sent successfully.']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to send email. Check server configuration.']);
}
