<?php
// Configuration for PHP Mailer / SMTP
// Copy this file to config.php and fill in the details

return [
    'smtp_host' => 'smtp.example.com',
    'smtp_port' => 587,
    'smtp_user' => 'user@example.com',
    'smtp_pass' => 'password',
    'smtp_secure' => 'tls', // ssl or tls
    'from_email' => 'noreply@opengpsr.org',
    'to_email' => 'contact@opengpsr.org',

    // Backend API URL (hidden behind proxy)
    // No trailing slash
    'backend_url' => 'http://localhost:3000',
];
