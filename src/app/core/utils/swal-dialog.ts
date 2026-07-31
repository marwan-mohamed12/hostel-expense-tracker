import Swal from 'sweetalert2';

const deleteDialogClasses = {
  popup: 'rounded-2xl',
  confirmButton: 'rounded-xl font-semibold',
  cancelButton: 'rounded-xl font-semibold',
} as const;

/** Destructive confirm dialog only. Success feedback uses app ToastService. */
export async function confirmDelete(options: {
  title: string;
  text?: string;
  html?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
}): Promise<boolean> {
  const result = await Swal.fire({
    title: options.title,
    text: options.text,
    html: options.html,
    icon: 'warning',
    showCancelButton: true,
    focusCancel: true,
    reverseButtons: true,
    confirmButtonText: options.confirmButtonText ?? 'Yes, delete',
    cancelButtonText: options.cancelButtonText ?? 'Cancel',
    confirmButtonColor: '#e11d48',
    cancelButtonColor: '#64748b',
    customClass: deleteDialogClasses,
  });

  return result.isConfirmed;
}
