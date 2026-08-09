<?php
// AI 对话代理：把前端请求转发到上游 /chat/completions，并把 SSE 流透传给前端
// 部署要求：PHP 8.0+（str_starts_with 等），服务器需启用 curl 扩展
// 前端请求体：{ apiUrl, apiKey, model, messages }

// 尽量关闭输出缓冲，保证流式输出（部分虚拟主机可能强制开启，退化为一次性返回，不影响功能）
@ini_set('zlib.output_compression', 'Off');
while (ob_get_level() > 0) {
    ob_end_clean();
}
@ini_set('max_execution_time', '0');
@ini_set('memory_limit', '512M');

// 拼接完整 API 地址：已包含对应后缀则原样使用，否则追加（与前端 api-utils.js 逻辑一致）
function buildUrl($base, $suffix)
{
    $url = trim((string) $base);
    $url = rtrim($url, '/');
    if ($url === '') return '';
    return (stripos($url, $suffix) !== false) ? $url : $url . $suffix;
}

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
if (!is_array($req)) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => '请求体不是合法的 JSON']);
    exit;
}

$apiUrl = trim((string) ($req['apiUrl'] ?? ''));
$apiKey = trim((string) ($req['apiKey'] ?? ''));
$model = $req['model'] ?? '';
$messages = $req['messages'] ?? [];

$url = buildUrl($apiUrl, '/chat/completions');
if (!$url) {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => '未配置 API 地址']);
    exit;
}

$postBody = json_encode([
    'model' => $model,
    'messages' => $messages,
    'stream' => true,
]);

$ch = curl_init($url);
$status = 200;
$first = true;
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_POSTFIELDS => $postBody,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 0,
    CURLOPT_CONNECTTIMEOUT => 30,
    // 捕获上游状态码，在输出首字节前决定转发状态与 Content-Type
    CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$status) {
        if (preg_match('#^HTTP/\S+\s+(\d+)#', $header, $m)) {
            $status = (int) $m[1];
        }
        return strlen($header);
    },
    // 逐块透传 SSE 数据并立即 flush
    CURLOPT_WRITEFUNCTION => function ($ch, $data) use (&$status, &$first) {
        if ($first) {
            $first = false;
            if ($status >= 400) {
                http_response_code($status);
                header('Content-Type: application/json; charset=utf-8');
            } else {
                header('Content-Type: text/event-stream; charset=utf-8');
                header('Cache-Control: no-cache');
                header('X-Accel-Buffering: no');
            }
        }
        echo $data;
        if (ob_get_level() > 0) ob_flush();
        flush();
        return strlen($data);
    },
]);

$ok = curl_exec($ch);
$err = curl_error($ch);
curl_close($ch);

if ($ok === false && $first) {
    // 未收到任何数据（连接失败），此时头还没发出，可正常返回错误
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => '代理请求失败：' . $err]);
}
