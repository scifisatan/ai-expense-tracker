import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@web/components/ui/dialog"
import { QueueView } from "./QueueView"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
}

const QueueDialog = ({ open, onOpenChange, currency }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Needs & Wants</DialogTitle>
          <DialogDescription>
            Wants draw from your Want Fund. Needs draw from your standing reserve.
          </DialogDescription>
        </DialogHeader>
        <QueueView currency={currency} />
      </DialogContent>
    </Dialog>
  )
}

export default QueueDialog
