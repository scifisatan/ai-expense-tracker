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
      <DialogContent className="sm:max-w-xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Priority Wishlist & Goals</DialogTitle>
          <DialogDescription>
            Ranked goals and wishlist items funded automatically by your daily spending discipline.
          </DialogDescription>
        </DialogHeader>
        <QueueView currency={currency} />
      </DialogContent>
    </Dialog>
  )
}

export default QueueDialog
