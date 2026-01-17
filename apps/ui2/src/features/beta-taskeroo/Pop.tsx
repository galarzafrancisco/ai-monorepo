import { useEffect, useRef, useState } from 'react';
import './Pop.css';
import { Text } from '../../ui/primitives';


type PopProps = {
  onCancel?: () => void;
  onSave: ({ title, description }: { title: string, description: string }) => void;
};


export function Pop({ onCancel, onSave }: PopProps) {

  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");

  // Animation helper
  const [open, setOpen] = useState(false);
  useEffect(() => {
    // allow one paint so transition can run
    requestAnimationFrame(() => {
      setOpen(true);
    });
  }, []);

  console.log(`open? ${open}`);

  // Helper to select the description field when user hits enter on the title
  const descriptionRef = useRef<HTMLTextAreaElement | null>(null);

  // Helper to expand height of description textarea
  function handleDescriptionChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setDescription(e.target.value);

    const el = e.target;
    el.style.height = "auto";                 // reset
    el.style.height = `${el.scrollHeight}px`; // grow
  }

  function handleCancel() {
    setOpen(false);
    // wait for animation to finish, THEN notify parent
    setTimeout(() => {
      onCancel?.();
    }, 220); // must match CSS duration
  }
  function handleSave() {
    onSave({
      title,
      description
    });
  }
  return (
    <div className={`pop__overlay ${open ? 'pop__overlay--open' : ''}`}>
      {/* <div className="pop__space"></div> */}
      <div className={`pop__main-panel ${open ? 'pop__main-panel--open' : ''}`}>
        <div className="pop__main-title ">
          <div onClick={handleCancel}>
            <Text size="4" weight='normal' className='pop__main-title-button'>
              cancel
            </Text>
          </div>
          <Text size="4" weight="medium">
            Create a task
          </Text>
          <div onClick={handleSave}>
            <Text size="4" weight='normal' className='pop__main-title-button'>
              save
            </Text>
          </div>
        </div>

        <div className="pop__main-content">

          <div className="pop__main__input-title">

            <input className="pop__main__input-title"
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  descriptionRef.current?.focus();
                }
              }}
            />

            <textarea className="pop__main__input-description"
              ref={descriptionRef}
              placeholder="Enter a description (optional)"
              value={description}
              onChange={handleDescriptionChange}
            />
          </div>
        </div>
      </div>
    </div>
  )
}