<?php
/**
 * Ramps Cube CRM — self-hosted sync endpoint.
 *
 * Replaces Firestore. Each module's collection is stored as a JSON string in one
 * row of `crm_workspace`. The browser client (src/lib/sync.ts) polls GET for
 * changes and POSTs updates. Last-write-wins per module.
 *
 * GET  /api.php?since=<ms>   -> { now, modules: { key: { payload, updatedAt } } }
 * POST /api.php  {key,payload}-> { ok, updatedAt }
 *
 * Auth: shared bearer token (Authorization: Bearer <token>), matched against the
 * token in crm-sync-config.php, which lives ABOVE the web root.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// Config lives in the account home, above every web root, so it is never served.
$configPath = '/home/u852408598/crm-sync-config.php';
if (!is_file($configPath)) {
    http_response_code(500);
    echo json_encode(['error' => 'not configured']);
    exit;
}
$cfg = require $configPath;

/** Extract the bearer token across the various ways the header can arrive. */
function bearer_token(): string {
    $h = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp($k, 'Authorization') === 0) { $h = $v; break; }
        }
    }
    if (stripos($h, 'Bearer ') === 0) return substr($h, 7);
    if (!empty($_SERVER['HTTP_X_SYNC_TOKEN'])) return $_SERVER['HTTP_X_SYNC_TOKEN'];
    return '';
}

if (!hash_equals((string) $cfg['token'], bearer_token())) {
    http_response_code(401);
    echo json_encode(['error' => 'unauthorized']);
    exit;
}

$mysqli = @new mysqli($cfg['db_host'], $cfg['db_user'], $cfg['db_pass'], $cfg['db_name']);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['error' => 'database unavailable']);
    exit;
}
$mysqli->set_charset('utf8mb4');

$method = $_SERVER['REQUEST_METHOD'];
$now = (int) round(microtime(true) * 1000);

if ($method === 'GET') {
    $since = isset($_GET['since']) ? (int) $_GET['since'] : 0;
    $stmt = $mysqli->prepare('SELECT module_key, payload, updated_at FROM crm_workspace WHERE updated_at > ?');
    $stmt->bind_param('i', $since);
    $stmt->execute();
    $res = $stmt->get_result();
    $modules = [];
    while ($row = $res->fetch_assoc()) {
        $modules[$row['module_key']] = [
            'payload'   => $row['payload'],
            'updatedAt' => (int) $row['updated_at'],
        ];
    }
    echo json_encode(['now' => $now, 'modules' => (object) $modules]);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    $key = isset($body['key']) ? (string) $body['key'] : '';
    $payload = $body['payload'] ?? null;
    if ($key === '' || strlen($key) > 64 || !is_string($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'bad request']);
        exit;
    }
    if (strlen($payload) > 4000000) {
        http_response_code(413);
        echo json_encode(['error' => 'payload too large']);
        exit;
    }
    $stmt = $mysqli->prepare(
        'INSERT INTO crm_workspace (module_key, payload, updated_at) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)'
    );
    $stmt->bind_param('ssi', $key, $payload, $now);
    $ok = $stmt->execute();
    if (!$ok) { http_response_code(500); echo json_encode(['error' => 'write failed']); exit; }
    echo json_encode(['ok' => true, 'updatedAt' => $now]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'method not allowed']);
