with open('resources/js/pages/Tenant/Onboarding/Wizard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

bottom_old = '''    return (
        <div className="min-h-screen bg-neutral-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">'''

bottom_new = '''    return (
        <>
        <div className="min-h-screen bg-neutral-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">'''

content = content.replace(bottom_old, bottom_new)

end_old = '''        </div>
    );
}'''

end_new = '''        </div>
        {captureOccupant !== null && (
            <KtpCaptureFlow
                onCapture={(file) => handleCapturedPhoto(file, captureOccupant)}
                onCancel={() => setCaptureOccupant(null)}
            />
        )}
        </>
    );
}'''

content = content.replace(end_old, end_new)

with open('resources/js/pages/Tenant/Onboarding/Wizard.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
