<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F3F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1A1A18;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F4F3F0;padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:14px;overflow:hidden;">
                    {{-- Header / Brand --}}
                    <tr>
                        <td style="background-color:#1A1A18;padding:28px 32px;text-align:center;">
                            <p style="margin:0;font-size:20px;font-weight:800;letter-spacing:2px;color:#FFFFFF;">MENTENG KOS PRIVATE</p>
                            <p style="margin:6px 0 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#A1A19A;">{{ $data['header_tagline'] }}</p>
                        </td>
                    </tr>

                    {{-- Title --}}
                    <tr>
                        <td style="padding:28px 32px 8px;">
                            <h1 style="margin:0;font-size:22px;line-height:1.3;color:#1A1A18;font-weight:800;">{{ $data['title'] }}</h1>
                        </td>
                    </tr>

                    {{-- Intro --}}
                    <tr>
                        <td style="padding:0 32px 16px;">
                            <p style="margin:0;font-size:14px;line-height:1.7;color:#4A4A45;">{{ $data['intro'] }}</p>
                        </td>
                    </tr>

                    {{-- Info card --}}
                    <tr>
                        <td style="padding:0 32px 16px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #E8E7E3;border-radius:12px;overflow:hidden;">
                                @foreach ($data['rows'] as $row)
                                    <tr>
                                        <td style="width:45%;padding:12px 16px;background-color:#FAFAF8;border-bottom:1px solid #E8E7E3;font-size:12px;font-weight:700;letter-spacing:0.3px;text-transform:uppercase;color:#8A8A84;vertical-align:top;">{{ $row[0] }}</td>
                                        <td style="padding:12px 16px;border-bottom:1px solid #F1F0EC;font-size:14px;font-weight:600;color:#1A1A18;vertical-align:top;">{!! $row[1] !!}</td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>

                    {{-- Status pill-ish line --}}
                    @if (! empty($data['status_badge']))
                        <tr>
                            <td style="padding:0 32px 16px;">
                                <span style="display:inline-block;padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;background-color:{{ $data['status_color'] }};color:#FFFFFF;">{{ $data['status_badge'] }}</span>
                            </td>
                        </tr>
                    @endif

                    {{-- Actions --}}
                    @if (! empty($data['actions']))
                        <tr>
                            <td style="padding:0 32px 12px;">
                                <p style="margin:0 0 8px;font-size:13px;font-weight:800;letter-spacing:0.3px;text-transform:uppercase;color:#1A1A18;">{{ $data['actions_title'] }}</p>
                                <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.8;color:#4A4A45;">
                                    @foreach ($data['actions'] as $action)
                                        <li>{{ $action }}</li>
                                    @endforeach
                                </ol>
                            </td>
                        </tr>
                    @endif

                    {{-- CTA button --}}
                    <tr>
                        <td style="padding:8px 32px 28px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                                <tr>
                                    <td align="left">
                                        <a href="{{ $data['action_url'] }}" style="display:inline-block;padding:13px 26px;border-radius:10px;background-color:#1A1A18;color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">{{ $data['action_label'] }} &rarr;</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    {{-- Footer note --}}
                    @if (! empty($data['note']))
                        <tr>
                            <td style="padding:0 32px 16px;">
                                <p style="margin:0;font-size:12px;line-height:1.6;color:#A1A19A;">{{ $data['note'] }}</p>
                            </td>
                        </tr>
                    @endif

                    {{-- Footer --}}
                    <tr>
                        <td style="padding:20px 32px;border-top:1px solid #F1F0EC;background-color:#FAFAF8;text-align:center;">
                            <p style="margin:0;font-size:11px;color:#A1A19A;line-height:1.6;">
                                MENTENG KOS PRIVATE &middot; Menteng, Jakarta Pusat<br>
                                Email otomatis dari sistem Meter Air. Mohon tidak membalas email ini.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>